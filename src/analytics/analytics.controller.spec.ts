import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let analyticsService: jest.Mocked<AnalyticsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: {
            getPlatformStats: jest.fn(),
            getActiveUsers: jest.fn(),
            getTransferVolume: jest.fn(),
            getUserStats: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(''),
          },
        },
      ],
    }).compile();

    controller = module.get(AnalyticsController);
    analyticsService = module.get(AnalyticsService);
  });

  it('returns platform analytics for admin endpoint', async () => {
    analyticsService.getPlatformStats.mockResolvedValue({ totals: { messages_sent: 10 } });

    const result = await controller.getPlatformAnalytics({
      startDate: '2026-01-01',
      endDate: '2026-03-24',
    });

    expect(result).toEqual({ totals: { messages_sent: 10 } });
    expect(analyticsService.getPlatformStats).toHaveBeenCalledWith({
      startDate: '2026-01-01',
      endDate: '2026-03-24',
    });
  });

  it('returns user activity analytics for admin endpoint', async () => {
    analyticsService.getActiveUsers.mockResolvedValue({ currentDau: 4, currentMau: 12 });

    const result = await controller.getUserAnalytics({
      startDate: '2026-01-01',
      endDate: '2026-03-24',
    });

    expect(result).toEqual({ currentDau: 4, currentMau: 12 });
    expect(analyticsService.getActiveUsers).toHaveBeenCalled();
  });

  it('returns transfer analytics with token filter', async () => {
    analyticsService.getTransferVolume.mockResolvedValue({ totalsByToken: { USDC: 50 } });

    const result = await controller.getTransferAnalytics({
      token: 'USDC',
      startDate: '2026-01-01',
      endDate: '2026-03-24',
    });

    expect(result).toEqual({ totalsByToken: { USDC: 50 } });
    expect(analyticsService.getTransferVolume).toHaveBeenCalledWith('USDC', {
      token: 'USDC',
      startDate: '2026-01-01',
      endDate: '2026-03-24',
    });
  });

  it('returns personal analytics for the authenticated user', async () => {
    analyticsService.getUserStats.mockResolvedValue({ userId: 'user-1', activeDays: 3 });

    const result = await controller.getMyAnalytics('user-1');

    expect(result).toEqual({ userId: 'user-1', activeDays: 3 });
    expect(analyticsService.getUserStats).toHaveBeenCalledWith('user-1');
  });
});
