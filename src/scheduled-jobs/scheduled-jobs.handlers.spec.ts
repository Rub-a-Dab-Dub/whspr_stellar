import { ScheduledJobHandlersService } from './scheduled-jobs.handlers';
import { ScheduledJobsOperations } from './scheduled-jobs.operations';

describe('ScheduledJobHandlersService', () => {
  let service: ScheduledJobHandlersService;
  let operations: jest.Mocked<ScheduledJobsOperations>;

  beforeEach(() => {
    operations = {
      pollBlockchainEvents: jest.fn().mockResolvedValue({ processedCount: 1 }),
      syncTransactionStatuses: jest.fn().mockResolvedValue({ processedCount: 1 }),
      refreshTokenPrices: jest.fn().mockResolvedValue({ processedCount: 1 }),
      syncNfts: jest.fn().mockResolvedValue({ processedCount: 1 }),
      cleanupSessions: jest.fn().mockResolvedValue({ processedCount: 1 }),
      checkTierExpiry: jest.fn().mockResolvedValue({ processedCount: 1 }),
      processReferralRewards: jest.fn().mockResolvedValue({ processedCount: 1 }),
      aggregateAnalytics: jest.fn().mockResolvedValue({ processedCount: 1 }),
      retryWebhookDelivery: jest.fn().mockResolvedValue({ processedCount: 1 }),
      cleanupAuditLogs: jest.fn().mockResolvedValue({ processedCount: 1 }),
    };

    service = new ScheduledJobHandlersService(operations);
  });

  it('executes all job handlers through operations layer', async () => {
    const debugSpy = jest.spyOn((service as any).logger, 'debug').mockImplementation();

    await service.pollBlockchainEvents();
    await service.syncTransactionStatuses();
    await service.refreshTokenPrices();
    await service.syncNfts();
    await service.cleanupSessions();
    await service.checkTierExpiry();
    await service.processReferralRewards();
    await service.aggregateAnalytics();
    await service.retryWebhookDelivery();
    await service.cleanupAuditLogs();

    expect(debugSpy).toHaveBeenCalledTimes(10);
    expect(operations.pollBlockchainEvents).toHaveBeenCalledTimes(1);
    expect(operations.syncTransactionStatuses).toHaveBeenCalledTimes(1);
    expect(operations.refreshTokenPrices).toHaveBeenCalledTimes(1);
    expect(operations.syncNfts).toHaveBeenCalledTimes(1);
    expect(operations.cleanupSessions).toHaveBeenCalledTimes(1);
    expect(operations.checkTierExpiry).toHaveBeenCalledTimes(1);
    expect(operations.processReferralRewards).toHaveBeenCalledTimes(1);
    expect(operations.aggregateAnalytics).toHaveBeenCalledTimes(1);
    expect(operations.retryWebhookDelivery).toHaveBeenCalledTimes(1);
    expect(operations.cleanupAuditLogs).toHaveBeenCalledTimes(1);
  });

  it('logs and rethrows handler errors with context', async () => {
    const errorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();
    operations.retryWebhookDelivery.mockRejectedValueOnce(new Error('operation failed'));

    await expect(service.retryWebhookDelivery()).rejects.toThrow('operation failed');
    expect(errorSpy).toHaveBeenCalled();
  });
});
