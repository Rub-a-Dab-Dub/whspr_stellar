import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Notification } from '../entities/notification.entity';
import { NotificationPreference } from '../entities/notification-preference.entity';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { GetNotificationsDto } from '../dto/notification-preferences.dto';
import { NotificationType, NotificationChannel } from '../enums/notification-type.enum';
import { QueueService } from '../../queue/queue.service';
import { NotificationGateway } from '../gateways/notification.gateway';
import { MentionDetectionService } from './mention-detection.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationPreference)
    private readonly preferenceRepository: Repository<NotificationPreference>,
    private readonly queueService: QueueService,
    private readonly notificationGateway: NotificationGateway,
    private readonly mentionDetectionService: MentionDetectionService,
  ) {}

  /**
   * Create and send a notification
   */
  async createNotification(
    createNotificationDto: CreateNotificationDto,
  ): Promise<Notification> {
    // Don't send notification to self
    if (createNotificationDto.senderId === createNotificationDto.recipientId) {
      this.logger.debug('Skipping self-notification');
      return null;
    }

    // Check if user has muted the sender or room
    const isMuted = await this.isNotificationMuted(
      createNotificationDto.recipientId,
      createNotificationDto.type,
      createNotificationDto.senderId,
      createNotificationDto.data?.roomId,
    );

    if (isMuted) {
      this.logger.debug('Notification muted for user');
      return null;
    }

    // Create notification
    const notification = this.notificationRepository.create({
      ...createNotificationDto,
      expiresAt: createNotificationDto.expiresAt
        ? new Date(createNotificationDto.expiresAt)
        : null,
    });

    const savedNotification = await this.notificationRepository.save(notification);

    // Send real-time notification
    await this.sendRealTimeNotification(savedNotification);

    // Queue for other channels (push, email)
    await this.queueNotificationDelivery(savedNotification);

    this.logger.log(`Notification created: ${savedNotification.id}`);
    return savedNotification;
  }

  /**
   * Get notifications for a user
   */
  async getNotifications(
    userId: string,
    query: GetNotificationsDto,
  ): Promise<{
    notifications: Notification[];
    total: number;
    unreadCount: number;
  }> {
    const page = parseInt(query.page || '1');
    const limit = Math.min(parseInt(query.limit || '20'), 100);
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<Notification> = {
      recipientId: userId,
      isDeleted: false,
    };

    if (query.type) {
      where.type = query.type;
    }

    if (query.unreadOnly) {
      where.isRead = false;
    }

    // Check for expired notifications
    where.expiresAt = null; // Include non-expiring notifications

    const [notifications, total] = await this.notificationRepository.findAndCount({
      where: [
        where,
        {
          ...where,
          expiresAt: null,
        },
      ],
      relations: ['sender'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    // Get unread count
    const unreadCount = await this.notificationRepository.count({
      where: {
        recipientId: userId,
        isRead: false,
        isDeleted: false,
      },
    });

    return {
      notifications,
      total,
      unreadCount,
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const result = await this.notificationRepository.update(
      {
        id: notificationId,
        recipientId: userId,
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      },
    );

    if (result.affected === 0) {
      throw new NotFoundException('Notification not found or already read');
    }

    // Emit real-time update
    this.notificationGateway.emitNotificationRead(userId, notificationId);
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.notificationRepository.update(
      {
        recipientId: userId,
        isRead: false,
        isDeleted: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      },
    );

    // Emit real-time update
    this.notificationGateway.emitAllNotificationsRead(userId);

    return result.affected || 0;
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    const result = await this.notificationRepository.update(
      {
        id: notificationId,
        recipientId: userId,
      },
      {
        isDeleted: true,
        deletedAt: new Date(),
      },
    );

    if (result.affected === 0) {
      throw new NotFoundException('Notification not found');
    }
  }

  /**
   * Create message notification with mention detection
   */
  async createMessageNotification(
    messageId: string,
    authorId: string,
    content: string,
    roomId: string,
    conversationId: string,
  ): Promise<void> {
    // Detect mentions
    const mentions = await this.mentionDetectionService.extractMentions(content);
    
    for (const mention of mentions) {
      await this.createNotification({
        recipientId: mention.userId,
        senderId: authorId,
        type: NotificationType.MENTION,
        title: `${mention.username} mentioned you`,
        message: content.length > 100 ? `${content.substring(0, 100)}...` : content,
        data: {
          messageId,
          roomId,
          conversationId,
          mentionedUsername: mention.username,
        },
        actionUrl: `/rooms/${roomId}/messages/${messageId}`,
      });
    }

    // Create general message notification for room members (if not a mention)
    if (mentions.length === 0) {
      // This would require room member service integration
      // await this.createRoomMessageNotification(messageId, authorId, content, roomId);
    }
  }

  /**
   * Create reaction notification
   */
  async createReactionNotification(
    messageId: string,
    messageAuthorId: string,
    reactingUserId: string,
    reactionType: string,
    action: 'added' | 'removed' = 'added',
  ): Promise<void> {
    if (messageAuthorId === reactingUserId) {
      return; // Don't notify about own reactions
    }

    await this.createNotification({
      recipientId: messageAuthorId,
      senderId: reactingUserId,
      type: NotificationType.REACTION,
      title: action === 'added' ? 'New reaction' : 'Reaction removed',
      message: `Someone ${action} a ${reactionType} reaction to your message`,
      data: {
        messageId,
        reactionType,
        action,
      },
      actionUrl: `/messages/${messageId}`,
    });
  }

  /**
   * Send real-time notification via WebSocket
   */
  private async sendRealTimeNotification(notification: Notification): Promise<void> {
    try {
      await this.notificationGateway.sendNotificationToUser(
        notification.recipientId,
        notification,
      );
    } catch (error) {
      this.logger.error('Failed to send real-time notification:', error);
    }
  }

  /**
   * Queue notification for delivery via other channels
   */
  private async queueNotificationDelivery(notification: Notification): Promise<void> {
    try {
      // Get user preferences for this notification type
      const preferences = await this.getUserPreferences(
        notification.recipientId,
        notification.type,
      );

      // Queue push notification
      if (preferences.push) {
        await this.queueService.addNotificationJob({
          type: 'push',
          notificationId: notification.id,
          recipientId: notification.recipientId,
          title: notification.title,
          message: notification.message,
          data: notification.data,
        });
      }

      // Queue email notification
      if (preferences.email) {
        await this.queueService.addNotificationJob({
          type: 'email',
          notificationId: notification.id,
          recipientId: notification.recipientId,
          title: notification.title,
          message: notification.message,
          data: notification.data,
        });
      }
    } catch (error) {
      this.logger.error('Failed to queue notification delivery:', error);
    }
  }

  /**
   * Check if notification is muted
   */
  private async isNotificationMuted(
    userId: string,
    type: NotificationType,
    senderId?: string,
    roomId?: string,
  ): Promise<boolean> {
    const preferences = await this.preferenceRepository.find({
      where: {
        userId,
        type,
      },
    });

    for (const pref of preferences) {
      // Check if notification type is disabled
      if (!pref.isEnabled) {
        return true;
      }

      // Check muted users
      if (senderId && pref.mutedUsers?.includes(senderId)) {
        return true;
      }

      // Check muted rooms
      if (roomId && pref.mutedRooms?.includes(roomId)) {
        return true;
      }

      // Check quiet hours
      if (pref.quietHoursStart && pref.quietHoursEnd) {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        if (currentTime >= pref.quietHoursStart && currentTime <= pref.quietHoursEnd) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get user preferences for notification type
   */
  private async getUserPreferences(
    userId: string,
    type: NotificationType,
  ): Promise<{ push: boolean; email: boolean; inApp: boolean }> {
    const preferences = await this.preferenceRepository.find({
      where: {
        userId,
        type,
      },
    });

    const result = {
      push: true,
      email: true,
      inApp: true,
    };

    for (const pref of preferences) {
      if (!pref.isEnabled) {
        switch (pref.channel) {
          case NotificationChannel.PUSH:
            result.push = false;
            break;
          case NotificationChannel.EMAIL:
            result.email = false;
            break;
          case NotificationChannel.IN_APP:
            result.inApp = false;
            break;
        }
      }
    }

    return result;
  }

  /**
   * Clean up expired notifications
   */
  async cleanupExpiredNotifications(): Promise<number> {
    const result = await this.notificationRepository.update(
      {
        expiresAt: new Date(),
        isDeleted: false,
      },
      {
        isDeleted: true,
        deletedAt: new Date(),
      },
    );

    this.logger.log(`Cleaned up ${result.affected || 0} expired notifications`);
    return result.affected || 0;
  }
}