import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Notification, InAppNotificationType } from './entities/notification.entity';

export interface NotificationQueryFilters {
  userId: string;
  page: number;
  limit: number;
  type?: InAppNotificationType;
}

@Injectable()
export class NotificationsRepository extends Repository<Notification> {
  constructor(private readonly dataSource: DataSource) {
    super(Notification, dataSource.createEntityManager());
  }

  async createAndSave(input: {
    userId: string;
    type: InAppNotificationType;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }): Promise<Notification> {
    const entity = this.create({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data ?? null,
      isRead: false,
      readAt: null,
    });

    return this.save(entity);
  }

  async findByIdForUser(id: string, userId: string): Promise<Notification | null> {
    return this.findOne({ where: { id, userId } });
  }

  async getNotifications(filters: NotificationQueryFilters): Promise<{
    items: Notification[];
    total: number;
    page: number;
    limit: number;
  }> {
    const qb = this.createQueryBuilder('notification').where(
      'notification.userId = :userId',
      { userId: filters.userId },
    );

    if (filters.type) {
      qb.andWhere('notification.type = :type', { type: filters.type });
    }

    qb.orderBy('notification.createdAt', 'DESC').addOrderBy('notification.id', 'DESC');
    qb.skip((filters.page - 1) * filters.limit).take(filters.limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page: filters.page,
      limit: filters.limit,
    };
  }

  async markRead(id: string, userId: string): Promise<number> {
    const result = await this.createQueryBuilder()
      .update(Notification)
      .set({ isRead: true, readAt: () => 'NOW()' })
      .where('id = :id', { id })
      .andWhere('userId = :userId', { userId })
      .andWhere('isRead = false')
      .execute();

    return result.affected ?? 0;
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.createQueryBuilder()
      .update(Notification)
      .set({ isRead: true, readAt: () => 'NOW()' })
      .where('userId = :userId', { userId })
      .andWhere('isRead = false')
      .execute();

    return result.affected ?? 0;
  }

  async countUnread(userId: string): Promise<number> {
    return this.count({ where: { userId, isRead: false } });
  }

  async softDeleteForUser(id: string, userId: string): Promise<number> {
    const result = await this.createQueryBuilder()
      .softDelete()
      .where('id = :id', { id })
      .andWhere('userId = :userId', { userId })
      .execute();

    return result.affected ?? 0;
  }
}
