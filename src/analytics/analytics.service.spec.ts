import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { getQueueToken } from '@nestjs/bullmq';
import { EventType } from './entities/analytics-event.entity';
import { QUEUE_NAMES } from '../queues/queues.module';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockQueue: any;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getQueueToken(QUEUE_NAMES.ANALYTICS),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  it('should track event to queue', async () => {
    const userId = 'test-user-id';
    const eventType = EventType.USER_LOGIN;
    const metadata = { walletAddress: '0x123' };

    await service.track(userId, eventType, metadata);

    expect(mockQueue.add).toHaveBeenCalledWith('track-event', {
      userId,
      eventType,
      metadata,
      ipAddress: undefined,
      userAgent: undefined,
    });
  });
});
