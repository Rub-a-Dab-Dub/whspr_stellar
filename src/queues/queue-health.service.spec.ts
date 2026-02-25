import { QueueHealthService } from './queue-health.service';

describe('QueueHealthService', () => {
  let service: QueueHealthService;

  const mockQueue = (name: string) => ({
    name,
    getWaitingCount: jest.fn().mockResolvedValue(5),
    getActiveCount: jest.fn().mockResolvedValue(2),
    getFailedCount: jest.fn().mockResolvedValue(1),
  });

  beforeEach(() => {
    service = new QueueHealthService(
      mockQueue('tx-verification') as any,
      mockQueue('wallet-creation') as any,
      mockQueue('notifications') as any,
      mockQueue('analytics') as any,
      mockQueue('room-expiry') as any,
    );
  });

  it('should return queue depths for all queues', async () => {
    const result = await service.getQueueDepths();
    expect(Object.keys(result)).toHaveLength(5);
    expect(result['tx-verification']).toEqual({ waiting: 5, active: 2, failed: 1 });
    expect(result['notifications']).toEqual({ waiting: 5, active: 2, failed: 1 });
  });
});
