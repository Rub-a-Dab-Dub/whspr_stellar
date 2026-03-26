import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationsGateway } from '../messaging/gateways/notifications.gateway';
import { NotificationType } from '../messaging/dto/notification-events.dto';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto';
import {
  NotificationListResponseDto,
  NotificationResponseDto,
  UnreadCountResponseDto,
} from './dto/notification-response.dto';
import { InAppNotificationType, Notification } from './entities/notification.entity';
import { NotificationsRepository } from './notifications.repository';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async createNotification(input: CreateNotificationDto): Promise<NotificationResponseDto> {
    const notification = await this.notificationsRepository.createAndSave(input);

    await this.notificationsGateway.sendNotification(input.userId, {
      id: notification.id,
      type: this.toGatewayType(input.type),
      title: notification.title,
      body: notification.body,
      data: notification.data ?? undefined,
    });

    await this.emitUnreadCount(input.userId);

    return this.toDto(notification);
  }

  async markRead(userId: string, id: string): Promise<NotificationResponseDto> {
    const existing = await this.notificationsRepository.findByIdForUser(id, userId);
    if (!existing) {
      throw new NotFoundException('Notification not found');
    }

    if (!existing.isRead) {
      await this.notificationsRepository.markRead(id, userId);
    }

    const updated = await this.notificationsRepository.findByIdForUser(id, userId);
    if (!updated) {
      throw new NotFoundException('Notification not found');
    }

    await this.notificationsGateway.sendNotificationRead(
      userId,
      updated.id,
      updated.readAt?.getTime() ?? Date.now(),
    );
    await this.emitUnreadCount(userId);

    return this.toDto(updated);
  }

  async markAllRead(userId: string): Promise<{ marked: number }> {
    const marked = await this.notificationsRepository.markAllRead(userId);

    await this.notificationsGateway.sendNotificationReadAll(userId);
    await this.emitUnreadCount(userId);

    return { marked };
  }

  async getNotifications(
    userId: string,
    query: GetNotificationsQueryDto,
  ): Promise<NotificationListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const result = await this.notificationsRepository.getNotifications({
      userId,
      page,
      limit,
      type: query.type,
    });

    return {
      items: result.items.map((item) => this.toDto(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  async deleteNotification(userId: string, id: string): Promise<void> {
    const affected = await this.notificationsRepository.softDeleteForUser(id, userId);
    if (affected === 0) {
      throw new NotFoundException('Notification not found');
    }

    await this.notificationsGateway.sendNotificationDeleted(userId, id);
    await this.emitUnreadCount(userId);
  }

  async getUnreadCount(userId: string): Promise<UnreadCountResponseDto> {
    const unreadCount = await this.notificationsRepository.countUnread(userId);
    return { unreadCount };
  }

  private async emitUnreadCount(userId: string): Promise<void> {
    const unreadCount = await this.notificationsRepository.countUnread(userId);
    await this.notificationsGateway.sendUnreadCountUpdate(userId, unreadCount);
  }

  private toDto(notification: Notification): NotificationResponseDto {
    return {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      isRead: notification.isRead,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }

  private toGatewayType(type: InAppNotificationType): NotificationType {
    return type as unknown as NotificationType;
  }
}
