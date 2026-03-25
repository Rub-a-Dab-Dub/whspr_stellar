import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalyticsModule } from '../analytics/analytics.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { ScheduledJobsService } from './scheduled-jobs.service';
import { DistributedLockService } from './distributed-lock.service';
import { ScheduledJobHandlersService } from './scheduled-jobs.handlers';
import { SCHEDULED_JOBS_OPERATIONS } from './scheduled-jobs.operations';
import { CompositeScheduledJobsOperations } from './scheduled-jobs.composite.operations';

@Module({
  imports: [ConfigModule, AnalyticsModule, TransactionsModule],
  providers: [
    ScheduledJobsService,
    DistributedLockService,
    ScheduledJobHandlersService,
    CompositeScheduledJobsOperations,
    {
      provide: SCHEDULED_JOBS_OPERATIONS,
      useExisting: CompositeScheduledJobsOperations,
    },
  ],
})
export class ScheduledJobsModule {}
