import { Injectable } from '@nestjs/common';
import {
  JobExecutionResult,
  NoopScheduledJobsOperations,
} from '../scheduled-jobs/scheduled-jobs.operations';
import { AnalyticsService } from './analytics.service';
import { BlockchainSyncService } from '../blockchain/services/blockchain-sync.service';

@Injectable()
export class AnalyticsScheduledJobsOperations extends NoopScheduledJobsOperations {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly blockchainSyncService: BlockchainSyncService,
  ) {
    super();
  }

  override async aggregateAnalytics(): Promise<JobExecutionResult> {
    const processedCount = await this.analyticsService.aggregateDailyMetrics();

    return {
      processedCount,
      metadata: {
        job: 'analytics-aggregation',
      },
    };
  }

  override async pollBlockchainEvents(): Promise<JobExecutionResult> {
    const processedCount = await this.blockchainSyncService.syncEvents();

    return {
      processedCount,
      metadata: {
        job: 'blockchain-event-polling',
      },
    };
  }
}
