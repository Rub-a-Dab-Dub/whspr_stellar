import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull, LessThanOrEqual, MoreThan } from 'typeorm';
import { Notification } from '../entities/notification.entity';
import { NotificationPreference } from '../entities/notification-preference.entity';
import { UserMute } from '../entities/user-mute.entity';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { NotificationQueryDto } from '../dto/notification-query.dto';
import { MarkReadDto, MarkAllReadDto } from '../dto/mark-read.dto';
import { NotificationStatus } from '../enums/notification-status.enum';
import { NotificationChannel } from '../enums/notification-channel.enum';
import { NotificationType } from '../enums/notification-type.enum';
import { MuteType } from '../enums/mute-type.enum';
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
    @InjectRepository(UserMute)
    private readonly muteRepository: Repository<UserMute>,
    private readonly queueService: QueueService,
    private readonly notificationGateway: NotificationGateway,
    private readonly mentionDetectionService: MentionDetectionService,
  ) {}

  /**
   * Create and send a notification
   */
  async createNotification(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepository.create({
      ...createNotificationDto,
      scheduledFor: createNotificationDto.scheduledFor ? new Date(createNotificationDto.scheduledFor) : null,
    });

    const savedNotification = await this.notificationRepository.save(notification);

    // Check if user is muted for this type of notification
    const isMuted = await this.isUserMuted(
      savedNotification.recipientId,
      savedNotification.type,
      savedNotification.senderId,
      savedNotification.roomId,
    );

    if (!isMuted) {
      // Send real-time notification via WebSocket
      await this.sendRealTimeNotification(savedNotification);

      // Queue for other channels (push, email, etc.)
      await this.queueNotificationDelivery(savedNotification);
    }

    this.logger.log(`Notification created: ${savedNotification.id} for user ${savedNotification.recipientId}`);
    return savedNotification;
  }

  /**
   * Get notifications for a user with pagination and filtering
   */
  async getNotifications(userId: string, query: NotificationQueryDto) {
    const {
      page = 1,
      limit = 20,
      type,
      status,
      isRead,
      category,
      roomId,
      senderId,
    } = query;

    const queryBuilder = this.notificationRepository
      .createQueryBuilder('notification')
      .leftJoinAndSelect('notification.sender', 'sender')
      .where('notification.recipientId = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC');

    if (type) {
      queryBuilder.andWhere('notification.type = :type', { type });
    }

    if (status) {
      queryBuilder.andWhere('notification.status = :status', { status });
    }

    if (isRead !== undefined) {
      queryBuilder.andWhere('notification.isRead = :isRead', { isRead });
    }

    if (category) {
      queryBuilder.andWhere('notification.category = :category', { category });
    }

    if (roomId) {
      queryBuilder.andWhere('notification.roomId = :roomId', { roomId });
    }

    if (senderId) {
      queryBuilder.andWhere('notification.senderId = :senderId', { senderId });
    }

    const [notifications, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Mark notifications as read
   */
  async markAsRead(userId: string, markReadDto: MarkReadDto): Promise<void> {
    const { notificationIds } = markReadDto;

    if (!notificationIds || notificationIds.length === 0) {
      return;
    }

    await this.notificationRepository.update(
      {
        id: In(notificationIds),
        recipientId: userId,
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      },
    );

    this.logger.log(`Marked ${notificationIds.length} notifications as read for user ${userId}`);
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string, markAllReadDto: MarkAllReadDto): Promise<void> {
    const { roomId } = markAllReadDto;

    const updateQuery = this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where('recipientId = :userId', { userId })
      .andWhere('isRead = :isRead', { isRead: false });

    if (roomId) {
      updateQuery.andWhere('roomId = :roomId', { roomId });
    }

    const result = await updateQuery.execute();

    this.logger.log(`Marked ${result.affected} notifications as read for user ${userId}`);
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string, roomId?: string): Promise<number> {
    const queryBuilder = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.recipientId = :userId', { userId })
      .andWhere('notification.isRead = :isRead', { isRead: false });

    if (roomId) {
      queryBuilder.andWhere('notification.roomId = :roomId', { roomId });
    }

    return queryBuilder.getCount();
  }

  /**
   * Delete notification
   */
  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, recipientId: userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.notificationRepository.remove(notification);
    this.logger.log(`Notification ${notificationId} deleted for user ${userId}`);
  }

  /**
   * Create message notification with mention detection
   */
  async createMessageNotification(
    messageId: string,
    content: string,
    authorId: string,
    roomId: string,
    recipientIds: string[],
  ): Promise<void> {
    // Detect mentions in the message
    const mentions = this.mentionDetectionService.extractMentions(content);

    for (const recipientId of recipientIds) {
      if (recipientId === authorId) continue; // Don't notify the author

      const isMentioned = mentions.some(mention => mention.userId === recipientId);
      const notificationType = isMentioned ? NotificationType.MENTION : NotificationType.MESSAGE;

      await this.createNotification({
        recipientId,
        type: notificationType,
        title: isMentioned ? 'You were mentioned' : 'New message',
        message: isMentioned 
          ? `You were mentioned in a message: ${content.substring(0, 100)}...`
          : `New message: ${content.substring(0, 100)}...`,
        senderId: authorId,
        roomId,
        messageId,
        data: {
          messageContent: content,
          mentions: isMentioned ? mentions : undefined,
        },
        actionUrl: `/rooms/${roomId}/messages/${messageId}`,
        category: 'message',
        priority: isMentioned ? 2 : 3,
      });
    }
  }

  /**
   * Create reaction notification
   */
  async createReactionNotification(
    messageId: string,
    messageAuthorId: string,
    reactorId: string,
    roomId: string,
    reaction: string,
  ): Promise<void> {
    if (messageAuthorId === reactorId) return; // Don't notify self-reactions

    await this.createNotification({
      recipientId: messageAuthorId,
      type: NotificationType.REACTION,
      title: 'Someone reacted to your message',
      message: `Someone reacted with ${reaction} to your message`,
      senderId: reactorId,
      roomId,
      messageId,
      data: {
        reaction,
      },
      actionUrl: `/rooms/${roomId}/messages/${messageId}`,
      category: 'reaction',
      priority: 4,
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
      this.logger.error(`Failed to send real-time notification: ${error.message}`);
    }
  }

  /**
   * Queue notification for delivery via other channels
   */
  private async queueNotificationDelivery(notification: Notification): Promise<void> {
    // Get user preferences for this notification type
    const preferences = await this.getUserPreferences(notification.recipientId, notification.type);

    for (const preference of preferences) {
      if (!preference.enabled) continue;

      await this.queueService.addNotificationJob({
        notificationId: notification.id,
        channel: preference.channel,
        recipientId: notification.recipientId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        settings: preference.settings,
      });
    }
  }

  /**
   * Check if user is muted for this notification
   */
  private async isUserMuted(
    userId: string,
    notificationType: NotificationType,
    senderId?: string | null,
    roomId?: string | null,
  ): Promise<boolean> {
    const now = new Date();

    // Check global mute
    const globalMute = await this.muteRepository.findOne({
      where: {
        userId,
        targetType: MuteType.GLOBAL,
        targetId: 'global',
        expiresAt: IsNull() || MoreThan(now),
      },
    });

    if (globalMute) return true;

    // Check room mute
    if (roomId) {
      const roomMute = await this.muteRepository.findOne({
        where: {
          userId,
          targetType: MuteType.ROOM,
          targetId: roomId,
          expiresAt: IsNull() || MoreThan(now),
        },
      });

      if (roomMute) return true;
    }

    // Check user mute
    if (senderId) {
      const userMute = await this.muteRepository.findOne({
        where: {
          userId,
          targetType: MuteType.USER,
          targetId: senderId,
          expiresAt: IsNull() || MoreThan(now),
        },
      });

      if (userMute) return true;
    }

    return false;
  }

  /**
   * Get user preferences for notification type
   */
  private async getUserPreferences(
    userId: string,
    notificationType: NotificationType,
  ): Promise<NotificationPreference[]> {
    return this.preferenceRepository.find({
      where: {
        userId,
        type: notificationType,
        enabled: true,
      },
    });
  }

  /**
   * Clean up old notifications
   */
  async cleanupOldNotifications(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.notificationRepository.delete({
      createdAt: LessThanOrEqual(cutoffDate),
      isRead: true,
    });

    this.logger.log(`Cleaned up ${result.affected} old notifications`);
    return result.affected || 0;
  }
}