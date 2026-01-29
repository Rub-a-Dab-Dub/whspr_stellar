import { Injectable, Logger } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationPreferenceService } from './notification-preference.service';
import { NotificationType } from '../enums/notification-type.enum';

/**
 * Service to integrate notifications with existing systems
 * This provides a simple interface for other modules to create notifications
 */
@Injectable()
export class NotificationIntegrationService {
  private readonly logger = new Logger(NotificationIntegrationService.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly preferenceService: NotificationPreferenceService,
  ) {}

  /**
   * Initialize notification preferences for new user
   */
  async initializeUserNotifications(userId: string): Promise<void> {
    try {
      await this.preferenceService.initializeDefaultPreferences(userId);
      this.logger.log(`Initialized notification preferences for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to initialize preferences for user ${userId}:`, error);
    }
  }

  /**
   * Send room invitation notification
   */
  async notifyRoomInvitation(
    recipientId: string,
    senderId: string,
    roomName: string,
    roomId: string,
    inviteUrl?: string,
  ): Promise<void> {
    try {
      await this.notificationService.createNotification({
        recipientId,
        senderId,
        type: NotificationType.ROOM_INVITE,
        title: 'Room Invitation',
        message: `You've been invited to join "${roomName}"`,
        data: {
          roomId,
          roomName,
        },
        actionUrl: inviteUrl || `/rooms/${roomId}`,
      });
    } catch (error) {
      this.logger.error('Failed to send room invitation notification:', error);
    }
  }

  /**
   * Send reward granted notification
   */
  async notifyRewardGranted(
    recipientId: string,
    rewardName: string,
    rewardValue?: string,
    rewardDescription?: string,
  ): Promise<void> {
    try {
      await this.notificationService.createNotification({
        recipientId,
        type: NotificationType.REWARD_GRANTED,
        title: 'Reward Received!',
        message: `You've received: ${rewardName}`,
        data: {
          rewardName,
          rewardValue,
          rewardDescription,
        },
        actionUrl: '/rewards',
      });
    } catch (error) {
      this.logger.error('Failed to send reward notification:', error);
    }
  }

  /**
   * Send level up notification
   */
  async notifyLevelUp(
    recipientId: string,
    newLevel: number,
    xpGained: number,
  ): Promise<void> {
    try {
      await this.notificationService.createNotification({
        recipientId,
        type: NotificationType.LEVEL_UP,
        title: 'Level Up!',
        message: `Congratulations! You've reached level ${newLevel}`,
        data: {
          newLevel,
          xpGained,
        },
        actionUrl: '/profile',
      });
    } catch (error) {
      this.logger.error('Failed to send level up notification:', error);
    }
  }

  /**
   * Send achievement notification
   */
  async notifyAchievement(
    recipientId: string,
    achievementName: string,
    achievementDescription: string,
  ): Promise<void> {
    try {
      await this.notificationService.createNotification({
        recipientId,
        type: NotificationType.ACHIEVEMENT,
        title: 'Achievement Unlocked!',
        message: `You've unlocked: ${achievementName}`,
        data: {
          achievementName,
          achievementDescription,
        },
        actionUrl: '/achievements',
      });
    } catch (error) {
      this.logger.error('Failed to send achievement notification:', error);
    }
  }

  /**
   * Send system notification
   */
  async notifySystem(
    recipientId: string,
    title: string,
    message: string,
    actionUrl?: string,
    data?: Record<string, any>,
  ): Promise<void> {
    try {
      await this.notificationService.createNotification({
        recipientId,
        type: NotificationType.SYSTEM,
        title,
        message,
        data,
        actionUrl,
      });
    } catch (error) {
      this.logger.error('Failed to send system notification:', error);
    }
  }

  /**
   * Bulk notify multiple users
   */
  async bulkNotify(
    userIds: string[],
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, any>,
    actionUrl?: string,
  ): Promise<void> {
    const promises = userIds.map(userId =>
      this.notificationService.createNotification({
        recipientId: userId,
        type,
        title,
        message,
        data,
        actionUrl,
      })
    );

    try {
      await Promise.allSettled(promises);
      this.logger.log(`Bulk notification sent to ${userIds.length} users`);
    } catch (error) {
      this.logger.error('Failed to send bulk notifications:', error);
    }
  }
}