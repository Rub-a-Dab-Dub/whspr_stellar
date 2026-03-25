import { Injectable } from '@nestjs/common';
import { SessionsService } from '../sessions/sessions.service';
import { JobExecutionResult, NoopScheduledJobsOperations } from './scheduled-jobs.operations';

@Injectable()
export class SessionScheduledJobsOperations extends NoopScheduledJobsOperations {
  constructor(private readonly sessionsService: SessionsService) {
    super();
  }

  override async cleanupSessions(): Promise<JobExecutionResult> {
    const processedCount = await this.sessionsService.cleanupExpired();

    return {
      processedCount,
      metadata: {
        job: 'session-cleanup',
      },
    };
  }
}
