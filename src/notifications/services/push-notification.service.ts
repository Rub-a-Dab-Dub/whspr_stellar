import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushSubscription } from '../entities/push-subscription.entity';
import { CreatePushSubscriptionDto, PushNotificationDto } from '../dto/push-subscription.dto';
import * as webpush from 'web-push';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(
    @InjectRepository(PushSubscription)
    private readonly subscriptionRepository: Repository<PushSubscription>,
    private readonly configService: ConfigService,
  ) {
    this.initializeWebPush();
  }

  /**
   * Initialize web-push configuration
   */
  private initializeWebPush(): void {
    const vapidPublicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const vapidSubject = this.configService.get<string>('VAPID_SUBJECT', 'mailto:admin@whspr.com');

    if (vapidPublicKey && vapidPrivateKey) {
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
      this.logger.log('Web push configured successfully');
    } else {
      this.logger.warn('VAPID keys not configured - push notifications will not work');
    }
  }

  /**
   * Subscribe user to push notifications
   */
  async subscribe(
    userId: string,
    subscriptionDto: CreatePushSubscriptionDto,
  ): Promise<PushSubscription> {
    // Check if subscription already exists
    const existingSubscription = await this.subscriptionRepository.findOne({
      where: {
        userId,
        endpoint: subscriptionDto.endpoint,
      },
    });

    if (existingSubscription) {
      // Update existing subscription
      Object.assign(existingSubscription, subscriptionDto, {
        isActive: true,
        lastUsedAt: new Date(),
      });
      const updated = await this.subscriptionRepository.save(existingSubscription);
      this.logger.log(`Updated push subscription for user ${userId}`);
      return updated;
    }

    // Create new subscription
    const subscription = this.subscriptionRepository.create({
      userId,
      ...subscriptionDto,
      isActive: true,
      lastUsedAt: new Date(),
    });

    const saved = await this.subscriptionRepository.save(subscription);
    this.logger.log(`Created push subscription for user ${userId}`);
    return saved;
  }

  /**
   * Unsubscribe user from push notifications
   */
  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    const result = await this.subscriptionRepository.update(
      { userId, endpoint },
      { isActive: false },
    );

    if (result.affected > 0) {
      this.logger.log(`Unsubscribed user ${userId} from push notifications`);
    }
  }

  /**
   * Send push notification to user
   */
  async sendPushNotification(
    userId: string,
    notification: PushNotificationDto,
  ): Promise<{ sent: number; failed: number }> {
    const subscriptions = await this.subscriptionRepository.find({
      where: {
        userId,
        isActive: true,
      },
    });

    if (subscriptions.length === 0) {
      this.logger.debug(`No active push subscriptions for user ${userId}`);
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: notification.icon || '/icons/notification-icon.png',
      badge: notification.badge || '/icons/badge-icon.png',
      image: notification.image,
      tag: notification.tag,
      data: {
        url: notification.url,
        ...notification.data,
      },
      actions: notification.url ? [
        {
          action: 'open',
          title: 'Open',
          icon: '/icons/open-icon.png',
        },
      ] : undefined,
    });

    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dhKey,
              auth: subscription.authKey,
            },
          },
          payload,
          {
            TTL: 24 * 60 * 60, // 24 hours
            urgency: 'normal',
          },
        );

        // Update last used timestamp
        await this.subscriptionRepository.update(
          { id: subscription.id },
          { lastUsedAt: new Date() },
        );

        sent++;
        this.logger.debug(`Push notification sent to subscription ${subscription.id}`);
      } catch (error) {
        failed++;
        this.logger.error(`Failed to send push notification to subscription ${subscription.id}:`, error);

        // Handle expired subscriptions
        if (error.statusCode === 410 || error.statusCode === 404) {
          await this.subscriptionRepository.update(
            { id: subscription.id },
            { isActive: false },
          );
          this.logger.log(`Deactivated expired subscription ${subscription.id}`);
        }
      }
    }

    this.logger.log(`Push notification sent to user ${userId}: ${sent} sent, ${failed} failed`);
    return { sent, failed };
  }

  /**
   * Send push notification to multiple users
   */
  async sendBulkPushNotification(
    userIds: string[],
    notification: PushNotificationDto,
  ): Promise<{ totalSent: number; totalFailed: number }> {
    let totalSent = 0;
    let totalFailed = 0;

    for (const userId of userIds) {
      const result = await this.sendPushNotification(userId, notification);
      totalSent += result.sent;
      totalFailed += result.failed;
    }

    return { totalSent, totalFailed };
  }

  /**
   * Get user's active subscriptions
   */
  async getUserSubscriptions(userId: string): Promise<PushSubscription[]> {
    return this.subscriptionRepository.find({
      where: {
        userId,
        isActive: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Clean up inactive subscriptions
   */
  async cleanupInactiveSubscriptions(daysInactive: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

    const result = await this.subscriptionRepository.delete({
      isActive: false,
      lastUsedAt: cutoffDate,
    });

    this.logger.log(`Cleaned up ${result.affected || 0} inactive push subscriptions`);
    return result.affected || 0;
  }

  /**
   * Test push notification
   */
  async testPushNotification(userId: string): Promise<{ sent: number; failed: number }> {
    const testNotification: PushNotificationDto = {
      title: 'Test Notification',
      body: 'This is a test push notification from Whspr Stellar',
      icon: '/icons/test-icon.png',
      tag: 'test',
      data: { test: true },
    };

    return this.sendPushNotification(userId, testNotification);
  }
}