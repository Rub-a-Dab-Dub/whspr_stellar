import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EventType } from './entities/analytics-event.entity';
import { QUEUE_NAMES } from '../queues/queues.module';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectQueue(QUEUE_NAMES.ANALYTICS) private analyticsQueue: Queue,
  ) {}

  async track(
    userId: string,
    eventType: EventType,
    metadata?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.analyticsQueue.add('track-event', {
      userId,
      eventType,
      metadata,
      ipAddress,
      userAgent,
    });
  }
}
