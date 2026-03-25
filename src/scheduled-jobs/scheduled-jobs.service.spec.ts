import { ScheduledJobsService } from './scheduled-jobs.service';
import { DistributedLockService } from './distributed-lock.service';
import { ScheduledJobHandlersService } from './scheduled-jobs.handlers';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';

describe('ScheduledJobsService', () => {
  let service: ScheduledJobsService;
  let handlers: jest.Mocked<ScheduledJobHandlersService>;
  let lockService: jest.Mocked<DistributedLockService>;
  let configService: jest.Mocked<ConfigService>;
  let schedulerRegistry: jest.Mocked<SchedulerRegistry>;

  beforeEach(() => {
    handlers = {
      pollBlockchainEvents: jest.fn(),
      syncTransactionStatuses: jest.fn(),
      refreshTokenPrices: jest.fn(),
      syncNfts: jest.fn(),
      cleanupSessions: jest.fn(),
      checkTierExpiry: jest.fn(),
      processReferralRewards: jest.fn(),
      aggregateAnalytics: jest.fn(),
      retryWebhookDelivery: jest.fn(),
      cleanupAuditLogs: jest.fn(),
    } as unknown as jest.Mocked<ScheduledJobHandlersService>;

    lockService = {
      runWithLock: jest.fn().mockImplementation(async (_name, _ttl, fn) => {
        await fn();
        return { executed: true };
      }),
    } as unknown as jest.Mocked<DistributedLockService>;

    configService = {
      get: jest.fn().mockImplementation((key: string, defaultValue: unknown) => {
        if (key === 'JOB_LOCK_TTL_MS') {
          return 15000;
        }
        return defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    schedulerRegistry = {
      addInterval: jest.fn(),
      addCronJob: jest.fn(),
    } as unknown as jest.Mocked<SchedulerRegistry>;

    service = new ScheduledJobsService(configService, schedulerRegistry, lockService, handlers);
  });

  it('registers all recurring jobs on init', () => {
    service.onModuleInit();
    expect(schedulerRegistry.addInterval).toHaveBeenCalledTimes(6);
    expect(schedulerRegistry.addCronJob).toHaveBeenCalledTimes(4);
  });

  it('executes blockchain event polling job', async () => {
    await service.triggerJob('blockchain-event-polling');
    expect(handlers.pollBlockchainEvents).toHaveBeenCalledTimes(1);
  });

  it('executes transaction status sync job', async () => {
    await service.triggerJob('transaction-status-sync');
    expect(handlers.syncTransactionStatuses).toHaveBeenCalledTimes(1);
  });

  it('executes token price refresh job', async () => {
    await service.triggerJob('token-price-refresh');
    expect(handlers.refreshTokenPrices).toHaveBeenCalledTimes(1);
  });

  it('executes nft sync job', async () => {
    await service.triggerJob('nft-sync');
    expect(handlers.syncNfts).toHaveBeenCalledTimes(1);
  });

  it('executes session cleanup job', async () => {
    await service.triggerJob('session-cleanup');
    expect(handlers.cleanupSessions).toHaveBeenCalledTimes(1);
  });

  it('executes tier expiry check job', async () => {
    await service.triggerJob('tier-expiry-check');
    expect(handlers.checkTierExpiry).toHaveBeenCalledTimes(1);
  });

  it('executes referral reward processing job', async () => {
    await service.triggerJob('referral-reward-processing');
    expect(handlers.processReferralRewards).toHaveBeenCalledTimes(1);
  });

  it('executes analytics aggregation job', async () => {
    await service.triggerJob('analytics-aggregation');
    expect(handlers.aggregateAnalytics).toHaveBeenCalledTimes(1);
  });

  it('executes webhook delivery retry job', async () => {
    await service.triggerJob('webhook-delivery-retry');
    expect(handlers.retryWebhookDelivery).toHaveBeenCalledTimes(1);
  });

  it('executes audit log cleanup job', async () => {
    await service.triggerJob('audit-log-cleanup');
    expect(handlers.cleanupAuditLogs).toHaveBeenCalledTimes(1);
  });

  it('does not run handler when lock is not acquired', async () => {
    lockService.runWithLock.mockResolvedValueOnce({ executed: false });
    await service.triggerJob('token-price-refresh');
    expect(handlers.refreshTokenPrices).not.toHaveBeenCalled();
  });

  it('captures errors from failed jobs', async () => {
    const errorSpy = jest.spyOn((service as any).logger, 'error');
    handlers.retryWebhookDelivery.mockRejectedValueOnce(new Error('boom'));

    await service.triggerJob('webhook-delivery-retry');

    expect(errorSpy).toHaveBeenCalled();
  });

  it('throws when triggering an unknown job', async () => {
    await expect(service.triggerJob('unknown-job' as never)).rejects.toThrow(
      'Unknown scheduled job',
    );
  });

  it('falls back to default interval for invalid env value', async () => {
    configService.get.mockImplementation((key: string, defaultValue: unknown) => {
      if (key === 'JOB_BLOCKCHAIN_EVENT_POLLING_MS') {
        return -1;
      }
      if (key === 'JOB_LOCK_TTL_MS') {
        return 15000;
      }
      return defaultValue;
    });

    const warnSpy = jest.spyOn((service as any).logger, 'warn');
    await service.triggerJob('blockchain-event-polling');
    expect(warnSpy).toHaveBeenCalled();
    expect(handlers.pollBlockchainEvents).toHaveBeenCalled();
  });
});
