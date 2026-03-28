import { Injectable } from '@nestjs/common'
import { ActivityFeedRepository } from '../repositories/activity-feed.repository'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { ActivityFeedGateway } from '../gateways/activity-feed.gateway'

@Injectable()
export class ActivityFeedService {
  constructor(
    private repo: ActivityFeedRepository,
    private eventEmitter: EventEmitter2,
    private gateway: ActivityFeedGateway,
  ) {}

  async publishActivity(payload: {
    userId: string
    actorId: string
    activityType: string
    resourceType: string
    resourceId?: string
    metadata?: any
  }) {
    const item = await this.repo.create(payload)

    // Emit internally
    this.eventEmitter.emit('activity.created', item)

    // Real-time push
    this.gateway.emitToUser(payload.userId, item)

    return item
  }

  async getFeed(userId: string, cursor?: string) {
    return this.repo.findFeed(userId, cursor)
  }

  async markRead(userId: string, id: string) {
    return this.repo.markRead(id, userId)
  }

  async markAllRead(userId: string) {
    return this.repo.markAllRead(userId)
  }

  async getUnreadCount(userId: string) {
    return this.repo.getUnreadCount(userId)
  }

  async deleteItem(userId: string, id: string) {
    return this.repo.deleteItem(id, userId)
  }
}