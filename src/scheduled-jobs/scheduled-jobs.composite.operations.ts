import { Injectable } from '@nestjs/common';
import {
  JobExecutionResult,
  NoopScheduledJobsOperations,
} from './scheduled-jobs.operations';
import { AnalyticsScheduledJobsOperations } from '../analytics/analytics.jobs';
import { TransactionsService } from '../transactions/services/transactions.service';

@Injectable()
export class CompositeScheduledJobsOperations extends NoopScheduledJobsOperations {
  constructor(
    private readonly analyticsOperations: AnalyticsScheduledJobsOperations,
    private readonly transactionsService: TransactionsService,
  ) {
    super();
  }

  override async aggregateAnalytics(): Promise<JobExecutionResult> {
    return this.analyticsOperations.aggregateAnalytics();
  }

  override async syncTransactionStatuses(): Promise<JobExecutionResult> {
    const processedCount = await this.transactionsService.pollPendingStatuses();

    return {
      processedCount,
      metadata: {
        job: 'transaction-status-sync',
      },
    };
  }
}
