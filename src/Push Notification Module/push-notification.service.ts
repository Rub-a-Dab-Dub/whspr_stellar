import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as admin from 'firebase-admin';
import { PushSubscriptionsRepository } from '../repositories/push-subscriptions.repository';
import { Platform } from '../entities/push-subscription.entity';
import { NotificationPayloadBuilder } from '../builders/notification-payload.builder';
import {
  DeviceRegistrationResult,
  NotificationPayload,
  PushJobData,
  SendResult,
} from '../interfaces/push-notification.interface';
import {
  PUSH_NOTIFICATION_QUEUE,
  PUSH_QUEUE_DEFAULT_JOB_OPTIONS,
  PushJobName,
} from '../queue/push-queue.constants';
import { FIREBASE_ADMIN } from '../firebase/firebase-admin.provider';

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private readonly FCM_INVALID_TOKEN_CODES = new Set([
    'messaging/invalid-registration-token',
    'messaging/registration-token-not-registered',
    'messaging/invalid-argument',
  ]);

  constructor(
    private readonly subscriptionsRepo: PushSubscriptionsRepository,
    private readonly payloadBuilder: NotificationPayloadBuilder,
    @InjectQueue(PUSH_NOTIFICATION_QUEUE)
    private readonly pushQueue: Queue<PushJobData>,
    @Inject(FIREBASE_ADMIN) private readonly firebaseApp: admin.app.App,
  ) {}

  // ─── Device Registration ─────────────────────────────────────────────────

  async registerDevice(
    userId: string,
    deviceToken: string,
    platform: Platform,
  ): Promise<DeviceRegistrationResult> {
    const { subscription, isNew } = await this.subscriptionsRepo.upsert(
      userId,
      deviceToken,
      platform,
    );
    this.logger.log(
      `Device ${isNew ? 'registered' : 'reactivated'}: userId=${userId} platform=${platform}`,
    );
    return {
      subscriptionId: subscription.id,
      userId: subscription.userId,
      platform: subscription.platform,
      isNew,
    };
  }

  async unregisterDevice(userId: string, deviceToken: string): Promise<void> {
    const subscription = await this.subscriptionsRepo.findByUserIdAndToken(
      userId,
      deviceToken,
    );
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    await this.subscriptionsRepo.deactivateByUserIdAndToken(userId, deviceToken);
    this.logger.log(`Device unregistered: userId=${userId}`);
  }

  async getUserSubscriptions(userId: string) {
    return this.subscriptionsRepo.findAll(userId);
  }

  // ─── Async Queue Enqueue ──────────────────────────────────────────────────

  async sendToUser(
    userId: string,
    payload: NotificationPayload,
    notificationType?: string,
  ): Promise<void> {
    await this.pushQueue.add(
      PushJobName.SEND_TO_USER,
      { userId, payload, notificationType },
      PUSH_QUEUE_DEFAULT_JOB_OPTIONS,
    );
  }

  async sendToUsers(
    userIds: string[],
    payload: NotificationPayload,
    notificationType?: string,
  ): Promise<void> {
    await this.pushQueue.add(
      PushJobName.SEND_TO_USERS,
      { userIds, payload, notificationType },
      PUSH_QUEUE_DEFAULT_JOB_OPTIONS,
    );
  }

  async sendToTopic(
    topic: string,
    payload: NotificationPayload,
  ): Promise<void> {
    await this.pushQueue.add(
      PushJobName.SEND_TO_TOPIC,
      { topic, payload },
      PUSH_QUEUE_DEFAULT_JOB_OPTIONS,
    );
  }

  // ─── Direct FCM Delivery (called by processor) ────────────────────────────

  async deliverToUser(
    userId: string,
    payload: NotificationPayload,
    notificationType?: string,
  ): Promise<SendResult> {
    const subscriptions = await this.subscriptionsRepo.findActiveByUserId(userId);
    if (!subscriptions.length) {
      this.logger.warn(`No active subscriptions for userId=${userId}`);
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    return this.deliverToSubscriptions(subscriptions, payload, notificationType);
  }

  async deliverToUsers(
    userIds: string[],
    payload: NotificationPayload,
    notificationType?: string,
  ): Promise<SendResult> {
    const subscriptions =
      await this.subscriptionsRepo.findActiveByUserIds(userIds);
    if (!subscriptions.length) {
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }
    return this.deliverToSubscriptions(subscriptions, payload, notificationType);
  }

  async deliverToTopic(
    topic: string,
    payload: NotificationPayload,
  ): Promise<void> {
    const message = this.payloadBuilder.buildTopicMessage(topic, payload);
    try {
      const messageId = await this.firebaseApp.messaging().send(message);
      this.logger.log(`Topic message sent: ${messageId} topic=${topic}`);
    } catch (err) {
      this.logger.error(`Topic send failed for topic=${topic}`, err);
      throw err;
    }
  }

  // ─── Internal Delivery Logic ──────────────────────────────────────────────

  private async deliverToSubscriptions(
    subscriptions: Awaited<ReturnType<PushSubscriptionsRepository['findActiveByUserId']>>,
    payload: NotificationPayload,
    notificationType?: string,
  ): Promise<SendResult> {
    const tokens = subscriptions.map((s) => s.deviceToken);
    const CHUNK_SIZE = 500; // FCM multicast limit
    const result: SendResult = { successCount: 0, failureCount: 0, invalidTokens: [] };

    for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
      const chunk = tokens.slice(i, i + CHUNK_SIZE);
      const multicast = this.payloadBuilder.buildMulticastMessage(
        chunk,
        payload,
        notificationType,
      );

      try {
        const batchResponse = await this.firebaseApp
          .messaging()
          .sendEachForMulticast(multicast);

        result.successCount += batchResponse.successCount;
        result.failureCount += batchResponse.failureCount;

        const invalidTokensInChunk: string[] = [];
        batchResponse.responses.forEach((resp, idx) => {
          if (!resp.success && resp.error) {
            const errorCode = resp.error.code;
            if (this.FCM_INVALID_TOKEN_CODES.has(errorCode)) {
              invalidTokensInChunk.push(chunk[idx]);
            } else {
              this.logger.warn(
                `FCM error for token[${idx}]: ${errorCode} - ${resp.error.message}`,
              );
            }
          }
        });

        result.invalidTokens.push(...invalidTokensInChunk);
      } catch (err) {
        this.logger.error('Multicast send failed', err);
        result.failureCount += chunk.length;
        throw err;
      }
    }

    // Clean up invalid tokens
    if (result.invalidTokens.length) {
      const removed = await this.subscriptionsRepo.removeInvalidTokens(
        result.invalidTokens,
      );
      this.logger.log(`Removed ${removed} invalid/expired FCM tokens`);
    }

    // Update lastUsedAt for successful deliveries
    const successfulSubs = subscriptions
      .filter((s) => !result.invalidTokens.includes(s.deviceToken))
      .map((s) => s.id);
    if (successfulSubs.length) {
      await this.subscriptionsRepo.updateLastUsed(successfulSubs);
    }

    return result;
  }

  // ─── Token Cleanup ────────────────────────────────────────────────────────

  async cleanupInvalidTokens(tokens: string[]): Promise<number> {
    return this.subscriptionsRepo.removeInvalidTokens(tokens);
  }
}
