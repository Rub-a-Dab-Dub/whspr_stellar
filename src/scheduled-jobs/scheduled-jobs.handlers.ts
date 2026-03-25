import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ScheduledJobsOperations,
  SCHEDULED_JOBS_OPERATIONS,
} from './scheduled-jobs.operations';

@Injectable()
export class ScheduledJobHandlersService {
  private readonly logger = new Logger(ScheduledJobHandlersService.name);

  constructor(
    @Inject(SCHEDULED_JOBS_OPERATIONS)
    private readonly operations: ScheduledJobsOperations,
  ) {}

  async pollBlockchainEvents(): Promise<void> {
    await this.executeJob('pollBlockchainEvents', () => this.operations.pollBlockchainEvents());
  }

  async syncTransactionStatuses(): Promise<void> {
    await this.executeJob('syncTransactionStatuses', () =>
      this.operations.syncTransactionStatuses(),
    );
  }

  async refreshTokenPrices(): Promise<void> {
    await this.executeJob('refreshTokenPrices', () => this.operations.refreshTokenPrices());
  }

  async syncNfts(): Promise<void> {
    await this.executeJob('syncNfts', () => this.operations.syncNfts());
  }

  async cleanupSessions(): Promise<void> {
    await this.executeJob('cleanupSessions', () => this.operations.cleanupSessions());
  }

  async checkTierExpiry(): Promise<void> {
    await this.executeJob('checkTierExpiry', () => this.operations.checkTierExpiry());
  }

  async processReferralRewards(): Promise<void> {
    await this.executeJob('processReferralRewards', () => this.operations.processReferralRewards());
  }

  async aggregateAnalytics(): Promise<void> {
    await this.executeJob('aggregateAnalytics', () => this.operations.aggregateAnalytics());
  }

  async retryWebhookDelivery(): Promise<void> {
    await this.executeJob('retryWebhookDelivery', () => this.operations.retryWebhookDelivery());
  }

  async cleanupAuditLogs(): Promise<void> {
    await this.executeJob('cleanupAuditLogs', () => this.operations.cleanupAuditLogs());
  }

  private async executeJob(
    jobName: string,
    execute: () => Promise<{ processedCount: number; metadata?: Record<string, unknown> }>,
  ): Promise<void> {
    const startedAt = Date.now();
    try {
      const result = await execute();
      this.logger.debug(
        `Handler completed: ${jobName} | processedCount=${result.processedCount} | durationMs=${
          Date.now() - startedAt
        }`,
      );
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Handler failed: ${jobName} | error=${error.message}`, error.stack);
      } else {
        this.logger.error(`Handler failed: ${jobName} | error=${String(error)}`);
      }
      throw error;
    }
  }
}
