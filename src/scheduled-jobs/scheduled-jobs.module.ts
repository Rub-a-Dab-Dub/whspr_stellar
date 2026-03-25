import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ScheduledJobsService } from './scheduled-jobs.service';
import { DistributedLockService } from './distributed-lock.service';
import { ScheduledJobHandlersService } from './scheduled-jobs.handlers';
import { SCHEDULED_JOBS_OPERATIONS } from './scheduled-jobs.operations';
import { AnalyticsScheduledJobsOperations } from '../analytics/analytics.jobs';

@Module({
  imports: [ConfigModule, AnalyticsModule],
  providers: [
    ScheduledJobsService,
    DistributedLockService,
    ScheduledJobHandlersService,
    {
      provide: SCHEDULED_JOBS_OPERATIONS,
      useExisting: AnalyticsScheduledJobsOperations,
    },
  ],
})
export class ScheduledJobsModule {}
