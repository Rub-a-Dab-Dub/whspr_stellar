import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { DistributedLockService } from './distributed-lock.service';
import { ScheduledJobHandlersService } from './scheduled-jobs.handlers';

type ScheduledJobName =
  | 'blockchain-event-polling'
  | 'transaction-status-sync'
  | 'token-price-refresh'
  | 'nft-sync'
  | 'session-cleanup'
  | 'tier-expiry-check'
  | 'referral-reward-processing'
  | 'analytics-aggregation'
  | 'webhook-delivery-retry'
  | 'audit-log-cleanup';

type IntervalJobConfig = {
  type: 'interval';
  name: ScheduledJobName;
  envKey: string;
  defaultValue: number;
  handler: () => Promise<void>;
};

type CronJobConfig = {
  type: 'cron';
  name: ScheduledJobName;
  envKey: string;
  defaultValue: string;
  handler: () => Promise<void>;
};

type JobConfig = IntervalJobConfig | CronJobConfig;

@Injectable()
export class ScheduledJobsService implements OnModuleInit {
  private readonly logger = new Logger(ScheduledJobsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly lockService: DistributedLockService,
    private readonly handlers: ScheduledJobHandlersService,
  ) {}

  onModuleInit(): void {
    for (const job of this.getJobConfigs()) {
      if (job.type === 'interval') {
        const intervalMs = this.getIntervalMs(job.envKey, job.defaultValue);
        const timer = setInterval(() => {
          void this.runJob(job, `${intervalMs}ms`);
        }, intervalMs);
        timer.unref();

        this.schedulerRegistry.addInterval(job.name, timer);
      } else {
        const cronExpression = this.configService.get<string>(job.envKey, job.defaultValue);
        const cronJob = CronJob.from({
          cronTime: cronExpression,
          onTick: () => {
            void this.runJob(job, cronExpression);
          },
          start: false,
          unrefTimeout: true,
        });

        this.schedulerRegistry.addCronJob(job.name, cronJob);
        cronJob.start();
      }
    }
  }

  async triggerJob(name: ScheduledJobName): Promise<void> {
    const target = this.getJobConfigs().find((job) => job.name === name);
    if (!target) {
      throw new Error(`Unknown scheduled job: ${name}`);
    }

    const schedule =
      target.type === 'interval'
        ? `${this.getIntervalMs(target.envKey, target.defaultValue)}ms`
        : this.configService.get<string>(target.envKey, target.defaultValue);

    await this.runJob(target, schedule);
  }

  private getJobConfigs(): JobConfig[] {
    return [
      {
        type: 'interval',
        name: 'blockchain-event-polling',
        envKey: 'JOB_BLOCKCHAIN_EVENT_POLLING_MS',
        defaultValue: 5000,
        handler: () => this.handlers.pollBlockchainEvents(),
      },
      {
        type: 'interval',
        name: 'transaction-status-sync',
        envKey: 'JOB_TRANSACTION_STATUS_SYNC_MS',
        defaultValue: 30000,
        handler: () => this.handlers.syncTransactionStatuses(),
      },
      {
        type: 'interval',
        name: 'token-price-refresh',
        envKey: 'JOB_TOKEN_PRICE_REFRESH_MS',
        defaultValue: 60000,
        handler: () => this.handlers.refreshTokenPrices(),
      },
      {
        type: 'interval',
        name: 'nft-sync',
        envKey: 'JOB_NFT_SYNC_MS',
        defaultValue: 600000,
        handler: () => this.handlers.syncNfts(),
      },
      {
        type: 'cron',
        name: 'session-cleanup',
        envKey: 'JOB_SESSION_CLEANUP_CRON',
        defaultValue: '0 2 * * *',
        handler: () => this.handlers.cleanupSessions(),
      },
      {
        type: 'cron',
        name: 'tier-expiry-check',
        envKey: 'JOB_TIER_EXPIRY_CHECK_CRON',
        defaultValue: '0 0 * * *',
        handler: () => this.handlers.checkTierExpiry(),
      },
      {
        type: 'interval',
        name: 'referral-reward-processing',
        envKey: 'JOB_REFERRAL_REWARD_PROCESSING_MS',
        defaultValue: 3600000,
        handler: () => this.handlers.processReferralRewards(),
      },
      {
        type: 'cron',
        name: 'analytics-aggregation',
        envKey: 'JOB_ANALYTICS_AGGREGATION_CRON',
        defaultValue: '0 0 * * *',
        handler: () => this.handlers.aggregateAnalytics(),
      },
      {
        type: 'interval',
        name: 'webhook-delivery-retry',
        envKey: 'JOB_WEBHOOK_DELIVERY_RETRY_MS',
        defaultValue: 300000,
        handler: () => this.handlers.retryWebhookDelivery(),
      },
      {
        type: 'cron',
        name: 'audit-log-cleanup',
        envKey: 'JOB_AUDIT_LOG_CLEANUP_CRON',
        defaultValue: '0 0 * * 0',
        handler: () => this.handlers.cleanupAuditLogs(),
      },
    ];
  }

  private getIntervalMs(envKey: string, defaultValue: number): number {
    const value = this.configService.get<number>(envKey, defaultValue);
    if (!Number.isFinite(value) || value <= 0) {
      this.logger.warn(`Invalid interval for ${envKey}; using default ${defaultValue}ms`);
      return defaultValue;
    }

    return value;
  }

  private async runJob(job: JobConfig, schedule: string): Promise<void> {
    const lockTtlMs = this.configService.get<number>('JOB_LOCK_TTL_MS', 15000);
    const startedAt = Date.now();

    try {
      const result = await this.lockService.runWithLock(job.name, lockTtlMs, async () => {
        await job.handler();
      });

      if (!result.executed) {
        return;
      }

      const durationMs = Date.now() - startedAt;
      this.logger.log(
        `Scheduled job executed: ${job.name} | schedule=${schedule} | durationMs=${durationMs}`,
      );
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const fullContext = {
        jobName: job.name,
        schedule,
        durationMs,
        lockTtlMs,
      };

      if (error instanceof Error) {
        this.logger.error(
          `Scheduled job failed: ${job.name} | context=${JSON.stringify(fullContext)} | error=${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(
          `Scheduled job failed: ${job.name} | context=${JSON.stringify(fullContext)} | error=${String(error)}`,
        );
      }
    }
  }
}
