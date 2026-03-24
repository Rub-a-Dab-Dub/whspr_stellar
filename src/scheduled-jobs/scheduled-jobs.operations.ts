import { Injectable } from '@nestjs/common';

export const SCHEDULED_JOBS_OPERATIONS = Symbol('SCHEDULED_JOBS_OPERATIONS');

export type JobExecutionResult = {
  processedCount: number;
  metadata?: Record<string, unknown>;
};

export interface ScheduledJobsOperations {
  pollBlockchainEvents(): Promise<JobExecutionResult>;
  syncTransactionStatuses(): Promise<JobExecutionResult>;
  refreshTokenPrices(): Promise<JobExecutionResult>;
  syncNfts(): Promise<JobExecutionResult>;
  cleanupSessions(): Promise<JobExecutionResult>;
  checkTierExpiry(): Promise<JobExecutionResult>;
  processReferralRewards(): Promise<JobExecutionResult>;
  aggregateAnalytics(): Promise<JobExecutionResult>;
  retryWebhookDelivery(): Promise<JobExecutionResult>;
  cleanupAuditLogs(): Promise<JobExecutionResult>;
}

@Injectable()
export class NoopScheduledJobsOperations implements ScheduledJobsOperations {
  async pollBlockchainEvents(): Promise<JobExecutionResult> {
    return { processedCount: 0 };
  }

  async syncTransactionStatuses(): Promise<JobExecutionResult> {
    return { processedCount: 0 };
  }

  async refreshTokenPrices(): Promise<JobExecutionResult> {
    return { processedCount: 0 };
  }

  async syncNfts(): Promise<JobExecutionResult> {
    return { processedCount: 0 };
  }

  async cleanupSessions(): Promise<JobExecutionResult> {
    return { processedCount: 0 };
  }

  async checkTierExpiry(): Promise<JobExecutionResult> {
    return { processedCount: 0 };
  }

  async processReferralRewards(): Promise<JobExecutionResult> {
    return { processedCount: 0 };
  }

  async aggregateAnalytics(): Promise<JobExecutionResult> {
    return { processedCount: 0 };
  }

  async retryWebhookDelivery(): Promise<JobExecutionResult> {
    return { processedCount: 0 };
  }

  async cleanupAuditLogs(): Promise<JobExecutionResult> {
    return { processedCount: 0 };
  }
}
