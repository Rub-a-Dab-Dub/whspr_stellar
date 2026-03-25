import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduledJobsService } from './scheduled-jobs.service';
import { DistributedLockService } from './distributed-lock.service';
import { ScheduledJobHandlersService } from './scheduled-jobs.handlers';
import {
  NoopScheduledJobsOperations,
  SCHEDULED_JOBS_OPERATIONS,
} from './scheduled-jobs.operations';

@Module({
  imports: [ConfigModule],
  providers: [
    ScheduledJobsService,
    DistributedLockService,
    ScheduledJobHandlersService,
    NoopScheduledJobsOperations,
    {
      provide: SCHEDULED_JOBS_OPERATIONS,
      useExisting: NoopScheduledJobsOperations,
    },
  ],
})
export class ScheduledJobsModule {}
