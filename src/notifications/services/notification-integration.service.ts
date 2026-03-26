import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationService } from './notification.service';
import { NotificationPreferenceService } from './notification-preference.service';
import { NotificationType } from '../enums/notification-type.enum';
import { User } from '../../user/entities/user.entity';
import { NotificationContentService } from '../../i18n/services/notification-content.service';

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
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly notificationContentService: NotificationContentService,
  ) {}

  /**
   * Initialize notification preferences for new user
   */
  async initializeUserNotifications(userId: string): Promise<void> {
    try {
      await this.preferenceService.initializeDefaultPreferences(userId);
      this.logger.log(
        `Initialized notification preferences for user ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to initialize preferences for user ${userId}:`,
        error,
      );
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
      const preferredLocale = await this.resolveUserLocale(recipientId);
      const content =
        this.notificationContentService.buildRoomInvitationNotification({
          preferredLocale,
          roomName,
        });

      await this.notificationService.createNotification({
        recipientId,
        senderId,
        type: NotificationType.ROOM_INVITE,
        title: content.title,
        message: content.message,
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
      const preferredLocale = await this.resolveUserLocale(recipientId);
      const content =
        this.notificationContentService.buildRewardGrantedNotification({
          preferredLocale,
          rewardName,
        });

      await this.notificationService.createNotification({
        recipientId,
        type: NotificationType.REWARD_GRANTED,
        title: content.title,
        message: content.message,
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
      const preferredLocale = await this.resolveUserLocale(recipientId);
      const content = this.notificationContentService.buildLevelUpNotification({
        preferredLocale,
        newLevel,
      });

      await this.notificationService.createNotification({
        recipientId,
        type: NotificationType.LEVEL_UP,
        title: content.title,
        message: content.message,
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
      const preferredLocale = await this.resolveUserLocale(recipientId);
      const content =
        this.notificationContentService.buildAchievementNotification({
          preferredLocale,
          achievementName,
        });

      await this.notificationService.createNotification({
        recipientId,
        type: NotificationType.ACHIEVEMENT,
        title: content.title,
        message: content.message,
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
    const promises = userIds.map((userId) =>
      this.notificationService.createNotification({
        recipientId: userId,
        type,
        title,
        message,
        data,
        actionUrl,
      }),
    );

    try {
      await Promise.allSettled(promises);
      this.logger.log(`Bulk notification sent to ${userIds.length} users`);
    } catch (error) {
      this.logger.error('Failed to send bulk notifications:', error);
    }
  }

  private async resolveUserLocale(userId: string): Promise<string | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'preferredLocale'],
    });

    return user?.preferredLocale ?? null;
  }
}
