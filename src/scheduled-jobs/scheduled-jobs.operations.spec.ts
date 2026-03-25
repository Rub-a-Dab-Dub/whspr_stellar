import {
  NoopScheduledJobsOperations,
  SCHEDULED_JOBS_OPERATIONS,
} from './scheduled-jobs.operations';

describe('NoopScheduledJobsOperations', () => {
  let service: NoopScheduledJobsOperations;

  beforeEach(() => {
    service = new NoopScheduledJobsOperations();
  });

  it('exports a stable DI token', () => {
    expect(typeof SCHEDULED_JOBS_OPERATIONS).toBe('symbol');
  });

  it('returns default results for all operations', async () => {
    await expect(service.pollBlockchainEvents()).resolves.toEqual({ processedCount: 0 });
    await expect(service.syncTransactionStatuses()).resolves.toEqual({ processedCount: 0 });
    await expect(service.refreshTokenPrices()).resolves.toEqual({ processedCount: 0 });
    await expect(service.syncNfts()).resolves.toEqual({ processedCount: 0 });
    await expect(service.cleanupSessions()).resolves.toEqual({ processedCount: 0 });
    await expect(service.checkTierExpiry()).resolves.toEqual({ processedCount: 0 });
    await expect(service.processReferralRewards()).resolves.toEqual({ processedCount: 0 });
    await expect(service.aggregateAnalytics()).resolves.toEqual({ processedCount: 0 });
    await expect(service.retryWebhookDelivery()).resolves.toEqual({ processedCount: 0 });
    await expect(service.cleanupAuditLogs()).resolves.toEqual({ processedCount: 0 });
  });
});
