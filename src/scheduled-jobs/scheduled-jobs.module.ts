import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SessionsModule } from '../sessions/sessions.module';
import { ScheduledJobsService } from './scheduled-jobs.service';
import { DistributedLockService } from './distributed-lock.service';
import { ScheduledJobHandlersService } from './scheduled-jobs.handlers';
import { SCHEDULED_JOBS_OPERATIONS } from './scheduled-jobs.operations';
import { SessionScheduledJobsOperations } from './session-scheduled-jobs.operations';

@Module({
  imports: [ConfigModule, SessionsModule],
  providers: [
    ScheduledJobsService,
    DistributedLockService,
    ScheduledJobHandlersService,
    SessionScheduledJobsOperations,
    {
      provide: SCHEDULED_JOBS_OPERATIONS,
      useExisting: SessionScheduledJobsOperations,
    },
  ],
})
export class ScheduledJobsModule {}
