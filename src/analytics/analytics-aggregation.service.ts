import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan } from 'typeorm';
import { AnalyticsEvent, EventType } from './entities/analytics-event.entity';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class AnalyticsAggregationService {
  constructor(
    @InjectRepository(AnalyticsEvent)
    private analyticsRepo: Repository<AnalyticsEvent>,
  ) {}

  async getEventStats(
    eventType?: EventType,
    userId?: string,
    from?: Date,
    to?: Date,
  ) {
    const query = this.analyticsRepo.createQueryBuilder('event');

    if (eventType) query.andWhere('event.eventType = :eventType', { eventType });
    if (userId) query.andWhere('event.userId = :userId', { userId });
    if (from) query.andWhere('event.createdAt >= :from', { from });
    if (to) query.andWhere('event.createdAt <= :to', { to });

    const [events, total] = await query.getManyAndCount();

    const byType = await this.analyticsRepo
      .createQueryBuilder('event')
      .select('event.eventType', 'type')
      .addSelect('COUNT(*)', 'count')
      .where(eventType ? 'event.eventType = :eventType' : '1=1', { eventType })
      .andWhere(userId ? 'event.userId = :userId' : '1=1', { userId })
      .andWhere(from ? 'event.createdAt >= :from' : '1=1', { from })
      .andWhere(to ? 'event.createdAt <= :to' : '1=1', { to })
      .groupBy('event.eventType')
      .getRawMany();

    return { total, byType, events };
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOldEvents() {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const result = await this.analyticsRepo.delete({
      createdAt: LessThan(ninetyDaysAgo),
    });

    console.log(`Deleted ${result.affected} analytics events older than 90 days`);
  }
}
