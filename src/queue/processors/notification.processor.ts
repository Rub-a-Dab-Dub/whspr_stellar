import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { QUEUE_NAMES } from '../queue.constants';
import { PushNotificationService } from '../../notifications/services/push-notification.service';
import { EmailNotificationService } from '../../notifications/services/email-notification.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../../notifications/entities/notification.entity';
import { User } from '../../user/entities/user.entity';

export enum NotificationType {
  EMAIL = 'email',
  PUSH = 'push',
  SMS = 'sms',
  LEVEL_UP = 'LEVEL_UP',
  REWARD_GRANTED = 'REWARD_GRANTED',
  REWARD_EXPIRED = 'REWARD_EXPIRED',
  REWARD_TRADED = 'REWARD_TRADED',
  REWARD_GIFTED = 'REWARD_GIFTED',
  REWARD_PURCHASED = 'REWARD_PURCHASED',
  REWARD_SOLD = 'REWARD_SOLD',
}

@Processor(QUEUE_NAMES.NOTIFICATIONS)
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly pushService: PushNotificationService,
    private readonly emailService: EmailNotificationService,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @Process()
  async handleNotification(job: Job) {
    this.logger.log(`Processing notification job ${job.id}`);
    this.logger.debug(`Job data: ${JSON.stringify(job.data)}`);

    try {
      const { type, notificationId, recipientId, title, message, data } = job.data;

      await job.progress(20);

      switch (type) {
        case 'email':
          await this.handleEmailNotification(notificationId, recipientId);
          break;
        case 'push':
          await this.handlePushNotification(recipientId, title, message, data);
          break;
        case 'sms':
          await this.handleSMSNotification(recipientId, message);
          break;
        case NotificationType.LEVEL_UP:
          await this.handleLevelUp(job.data);
          break;
        case NotificationType.REWARD_GRANTED:
        case NotificationType.REWARD_EXPIRED:
        case NotificationType.REWARD_TRADED:
        case NotificationType.REWARD_GIFTED:
        case NotificationType.REWARD_PURCHASED:
        case NotificationType.REWARD_SOLD:
          await this.handleRewardNotification(job.data);
          break;
        default:
          throw new Error(`Unknown notification type: ${type}`);
      }

      await job.progress(100);
      this.logger.log(`Notification job ${job.id} completed successfully`);

      return {
        success: true,
        type,
        recipientId,
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Notification job ${job.id} failed:`, error);
      throw error;
    }
  }

  private async handleEmailNotification(notificationId: string, recipientId: string) {
    try {
      const notification = await this.notificationRepository.findOne({
        where: { id: notificationId },
        relations: ['sender'],
      });

      if (!notification) {
        throw new Error(`Notification ${notificationId} not found`);
      }

      const user = await this.userRepository.findOne({
        where: { id: recipientId },
      });

      if (!user) {
        throw new Error(`User ${recipientId} not found`);
      }

      await this.emailService.sendEmailNotification(notification, user.email);
      this.logger.log(`Email notification sent to ${user.email}`);
    } catch (error) {
      this.logger.error('Failed to send email notification:', error);
      throw error;
    }
  }

  private async handlePushNotification(recipientId: string, title: string, message: string, data: any) {
    try {
      const result = await this.pushService.sendPushNotification(recipientId, {
        title,
        body: message,
        data,
      });

      this.logger.log(`Push notification sent to user ${recipientId}: ${result.sent} sent, ${result.failed} failed`);
    } catch (error) {
      this.logger.error('Failed to send push notification:', error);
      throw error;
    }
  }

  private async handleSMSNotification(recipientId: string, message: string) {
    this.logger.log(`Sending push notification to ${recipient}`);
    // TODO: Implement actual push notification logic (e.g., using Firebase, OneSignal, etc.)
    await new Promise((resolve) => setTimeout(resolve, 500));
    this.logger.log(`Push notification sent to ${recipient}`);
  }

  private async sendSMS(recipient: string, message: string, metadata: any) {
    this.logger.log(`Sending SMS to ${recipient}`);
    // TODO: Implement actual SMS sending logic (e.g., using Twilio, AWS SNS, etc.)
    await new Promise((resolve) => setTimeout(resolve, 500));
    this.logger.log(`SMS sent to ${recipient}`);
  }

  private async handleLevelUp(data: any) {
    const { userId, username, oldLevel, newLevel, currentXp } = data;
    this.logger.log(
      `🎉 User ${username} (${userId}) leveled up from ${oldLevel} to ${newLevel}! Current XP: ${currentXp}`,
    );
    // TODO: Implement actual level-up notification logic
    // - Send push notification to user
    // - Send in-app notification
    // - Update user achievements/badges
    // - Broadcast to friends/followers
    await new Promise((resolve) => setTimeout(resolve, 500));
    this.logger.log(`Level-up notification processed for user ${username}`);
  }

  private async handleRewardNotification(data: any) {
    const { type, userId, rewardId, rewardName, rewardType, message, eventName } = data;
    this.logger.log(
      `🎁 Reward notification: ${type} for user ${userId}, reward: ${rewardName || rewardId}`,
    );
    
    // TODO: Implement actual reward notification logic
    // - Send push notification to user
    // - Send in-app notification
    // - Update user's reward inventory UI
    // - For trades/gifts, notify both parties
    
    await new Promise((resolve) => setTimeout(resolve, 500));
    this.logger.log(`Reward notification ${type} processed for user ${userId}`);
  }
}
    this.logger.log(`SMS notification would be sent to user ${recipientId}: ${message}`);
    // TODO: Implement SMS sending logic (e.g., using Twilio, AWS SNS, etc.)
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  private async handleLevelUp(data: any) {
    this.logger.log(`Handling level up notification: ${JSON.stringify(data)}`);
    // TODO: Implement level up notification logic
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  private async handleRewardNotification(data: any) {
    this.logger.log(`Handling reward notification: ${JSON.stringify(data)}`);
    // TODO: Implement reward notification logic
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}