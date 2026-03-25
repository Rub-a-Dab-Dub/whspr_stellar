import { Injectable } from '@nestjs/common';
import {
  JobExecutionResult,
  NoopScheduledJobsOperations,
} from '../scheduled-jobs/scheduled-jobs.operations';
import { AnalyticsService } from './analytics.service';

@Injectable()
export class AnalyticsScheduledJobsOperations extends NoopScheduledJobsOperations {
  constructor(private readonly analyticsService: AnalyticsService) {
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
}
