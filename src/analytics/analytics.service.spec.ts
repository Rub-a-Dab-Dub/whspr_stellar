import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsService } from './analytics.service';
import { AnalyticsEvent } from './entities/analytics-event.entity';
import { DailyMetric } from './entities/daily-metric.entity';
import { User } from '../users/entities/user.entity';

type MockQueryBuilder = {
  select: jest.Mock;
  addSelect: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  groupBy: jest.Mock;
  orderBy: jest.Mock;
  addOrderBy: jest.Mock;
  getRawMany: jest.Mock;
  getRawOne: jest.Mock;
  getMany: jest.Mock;
};

type QueryBuilderLike = Pick<
  Repository<AnalyticsEvent>,
  'createQueryBuilder'
>['createQueryBuilder'] extends (...args: never[]) => infer TResult
  ? TResult
  : never;

type DailyMetricQueryBuilderLike = Pick<
  Repository<DailyMetric>,
  'createQueryBuilder'
>['createQueryBuilder'] extends (...args: never[]) => infer TResult
  ? TResult
  : never;

const createQueryBuilderMock = (): MockQueryBuilder => {
  const builder: MockQueryBuilder = {
    select: jest.fn(),
    addSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    groupBy: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    getRawMany: jest.fn(),
    getRawOne: jest.fn(),
    getMany: jest.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.addSelect.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.andWhere.mockReturnValue(builder);
  builder.groupBy.mockReturnValue(builder);
  builder.orderBy.mockReturnValue(builder);
  builder.addOrderBy.mockReturnValue(builder);

  return builder;
};

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let analyticsEventRepository: jest.Mocked<Repository<AnalyticsEvent>>;
  let dailyMetricRepository: jest.Mocked<Repository<DailyMetric>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let cacheManager: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
  };

  beforeEach(async () => {
    cacheManager = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getRepositoryToken(AnalyticsEvent),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(DailyMetric),
          useValue: {
            create: jest.fn((value) => value),
            save: jest.fn(),
            delete: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            count: jest.fn(),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: cacheManager,
        },
      ],
    }).compile();

    service = module.get(AnalyticsService);
    analyticsEventRepository = module.get(getRepositoryToken(AnalyticsEvent));
    dailyMetricRepository = module.get(getRepositoryToken(DailyMetric));
    userRepository = module.get(getRepositoryToken(User));
  });

  it('tracks normalized events and is idempotent when idempotency key is reused', async () => {
    analyticsEventRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'event-1',
      eventType: 'message_sent',
      metricKey: 'messages_sent',
    } as AnalyticsEvent);
    analyticsEventRepository.create.mockImplementation((value) => value as AnalyticsEvent);
    analyticsEventRepository.save.mockImplementation(
      async (value) =>
        ({
          id: 'event-1',
          createdAt: new Date(),
          ...value,
        }) as AnalyticsEvent,
    );

    const created = await service.trackEvent('message-sent', 'user-1', {
      idempotencyKey: 'evt-123',
    });
    const duplicate = await service.trackEvent('message-sent', 'user-1', {
      idempotencyKey: 'evt-123',
    });

    expect(created.metricKey).toBe('messages_sent');
    expect(analyticsEventRepository.save).toHaveBeenCalledTimes(1);
    expect(duplicate.id).toBe('event-1');
    expect(cacheManager.del).toHaveBeenCalledWith('analytics:users:user-1');
  });

  it('aggregates daily metrics, transfer volumes, and distinct active users without double counting', async () => {
    const eventCountsBuilder = createQueryBuilderMock();
    eventCountsBuilder.getRawMany.mockResolvedValue([
      { metricKey: 'messages_sent', value: '3' },
      { metricKey: 'new_users', value: '1' },
    ]);

    const distinctUsersBuilder = createQueryBuilderMock();
    distinctUsersBuilder.getRawOne.mockResolvedValue({ value: '2' });

    const transferVolumesBuilder = createQueryBuilderMock();
    transferVolumesBuilder.getRawMany.mockResolvedValue([{ token: 'USDC', value: '42.50000000' }]);

    analyticsEventRepository.createQueryBuilder
      .mockReturnValueOnce(eventCountsBuilder as unknown as QueryBuilderLike)
      .mockReturnValueOnce(distinctUsersBuilder as unknown as QueryBuilderLike)
      .mockReturnValueOnce(transferVolumesBuilder as unknown as QueryBuilderLike);

    dailyMetricRepository.delete.mockResolvedValue({ raw: [] });
    (dailyMetricRepository.save as jest.Mock).mockResolvedValue([]);

    const processedCount = await service.aggregateDailyMetrics('2026-03-23');

    expect(processedCount).toBe(4);
    expect(dailyMetricRepository.delete).toHaveBeenCalledWith({ date: '2026-03-23' });
    expect(dailyMetricRepository.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ metricKey: 'messages_sent', value: '3' }),
        expect.objectContaining({ metricKey: 'new_users', value: '1' }),
        expect.objectContaining({ metricKey: 'active_users', value: '2' }),
        expect.objectContaining({
          metricKey: 'transfer_volume',
          value: '42.50000000',
          metadata: { token: 'USDC' },
        }),
      ]),
    );
  });

  it('returns active user analytics including DAU and MAU distinct counts', async () => {
    const activeUsersBuilder = createQueryBuilderMock();
    activeUsersBuilder.getMany.mockResolvedValue([
      {
        date: '2026-03-22',
        metricKey: 'active_users',
        value: '2',
        metadata: {},
      } as DailyMetric,
    ]);

    const newUsersBuilder = createQueryBuilderMock();
    newUsersBuilder.getMany.mockResolvedValue([
      {
        date: '2026-03-22',
        metricKey: 'new_users',
        value: '1',
        metadata: {},
      } as DailyMetric,
    ]);

    const currentDauBuilder = createQueryBuilderMock();
    currentDauBuilder.getRawOne.mockResolvedValue({ value: '3' });

    const currentMauBuilder = createQueryBuilderMock();
    currentMauBuilder.getRawOne.mockResolvedValue({ value: '7' });

    dailyMetricRepository.createQueryBuilder
      .mockReturnValueOnce(activeUsersBuilder as unknown as DailyMetricQueryBuilderLike)
      .mockReturnValueOnce(newUsersBuilder as unknown as DailyMetricQueryBuilderLike);
    analyticsEventRepository.createQueryBuilder
      .mockReturnValueOnce(currentDauBuilder as unknown as QueryBuilderLike)
      .mockReturnValueOnce(currentMauBuilder as unknown as QueryBuilderLike);

    const result = await service.getActiveUsers({
      startDate: '2026-03-01',
      endDate: '2026-03-24',
    });

    expect(result).toEqual({
      range: {
        start: '2026-03-01',
        end: '2026-03-24',
      },
      currentDau: 3,
      currentMau: 7,
      dailyActiveUsers: [{ date: '2026-03-22', value: 2 }],
      dailyNewUsers: [{ date: '2026-03-22', value: 1 }],
    });
  });

  it('returns cached platform stats when available', async () => {
    cacheManager.get.mockResolvedValueOnce({ cached: true });

    const result = await service.getPlatformStats({
      startDate: '2026-01-01',
      endDate: '2026-03-24',
    });

    expect(result).toEqual({ cached: true });
    expect(dailyMetricRepository.createQueryBuilder).not.toHaveBeenCalled();
    expect(userRepository.count).not.toHaveBeenCalled();
  });
});
