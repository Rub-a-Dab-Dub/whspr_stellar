import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserStatsService } from '../services/user-stats.service';

@Injectable()
export class UserStatsAggregationJob {
  private readonly logger = new Logger(UserStatsAggregationJob.name);

  constructor(private readonly userStatsService: UserStatsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async aggregateDaily(): Promise<void> {
    this.logger.log('Aggregating daily user stats...');
    await this.userStatsService.aggregateDailyStats();
  }

  @Cron(CronExpression.EVERY_WEEK)
  async aggregateWeekly(): Promise<void> {
    this.logger.log('Aggregating weekly user stats...');
    await this.userStatsService.aggregateWeeklyStats();
  }
}
