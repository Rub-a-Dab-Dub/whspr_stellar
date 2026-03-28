import { Injectable } from '@nestjs/common'
import { Repository } from 'typeorm'
import { InjectRepository } from '@nestjs/typeorm'
import { ActivityFeedItem } from '../entities/activity-feed-item.entity'

@Injectable()
export class ActivityFeedRepository {
  constructor(
    @InjectRepository(ActivityFeedItem)
    private repo: Repository<ActivityFeedItem>,
  ) {}

  async create(item: Partial<ActivityFeedItem>) {
    return this.repo.save(item)
  }

  async findFeed(userId: string, cursor?: string, limit = 20) {
    const qb = this.repo
      .createQueryBuilder('feed')
      .where('feed.userId = :userId', { userId })
      .orderBy('feed.createdAt', 'DESC')
      .addOrderBy('feed.id', 'DESC')
      .take(limit)

    if (cursor) {
      qb.andWhere('feed.createdAt < :cursor', { cursor })
    }

    const items = await qb.getMany()

    return {
      data: items,
      nextCursor: items.length ? items[items.length - 1].createdAt : null,
    }
  }

  async markRead(id: string, userId: string) {
    return this.repo.update({ id, userId }, { isRead: true })
  }

  async markAllRead(userId: string) {
    return this.repo.update({ userId, isRead: false }, { isRead: true })
  }

  async getUnreadCount(userId: string) {
    return this.repo.count({
      where: { userId, isRead: false },
    })
  }

  async deleteItem(id: string, userId: string) {
    return this.repo.delete({ id, userId })
  }
}