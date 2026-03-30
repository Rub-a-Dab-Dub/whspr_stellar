import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from '../cache/cache.service';
import { UserTier } from '../users/entities/user.entity';
import { FeatureFlag } from './entities/feature-flag.entity';
import { FeatureFlagsEvents } from './feature-flags.events';
import { FeatureFlagsRepository } from './feature-flags.repository';
import { FeatureFlagsService } from './feature-flags.service';

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;
  let repository: jest.Mocked<FeatureFlagsRepository>;
  let cache: { values: Map<string, unknown> };
  let events: jest.Mocked<FeatureFlagsEvents>;

  beforeEach(async () => {
    cache = { values: new Map<string, unknown>() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagsService,
        {
          provide: FeatureFlagsRepository,
          useValue: {
            findAll: jest.fn(),
            findByKey: jest.fn(),
            create: jest.fn((value: Partial<FeatureFlag>) => value),
            save: jest.fn(async (value: Partial<FeatureFlag>) => ({
              ...value,
              updatedAt: new Date('2026-01-01T00:00:00.000Z'),
            })),
          },
        },
        {
          provide: CacheService,
          useValue: {
            getOrSet: jest.fn(async (key, _ttl, fetcher) => {
              if (cache.values.has(key)) {
                return cache.values.get(key);
              }

              const value = await fetcher();
              cache.values.set(key, value);
              return value;
            }),
          },
        },
        {
          provide: FeatureFlagsEvents,
          useValue: {
            emitChanged: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(FeatureFlagsService);
    repository = module.get(FeatureFlagsRepository);
    events = module.get(FeatureFlagsEvents);
  });

  it('returns false when a flag is disabled', async () => {
    repository.findAll.mockResolvedValue([
      {
        key: 'beta-dashboard',
        isEnabled: false,
        rolloutPercentage: 100,
        allowedUserIds: [],
        allowedTiers: [],
        description: null,
        updatedAt: new Date(),
      },
    ]);

    await expect(service.isEnabled('beta-dashboard')).resolves.toBe(false);
  });

  it('enables a flag for an explicitly allowed user', async () => {
    repository.findAll.mockResolvedValue([
      {
        key: 'beta-dashboard',
        isEnabled: true,
        rolloutPercentage: 0,
        allowedUserIds: ['user-42'],
        allowedTiers: [],
        description: null,
        updatedAt: new Date(),
      },
    ]);

    await expect(service.isEnabledForUser('beta-dashboard', 'user-42')).resolves.toBe(true);
  });

  it('enables a flag for an allowed tier', async () => {
    repository.findAll.mockResolvedValue([
      {
        key: 'beta-dashboard',
        isEnabled: true,
        rolloutPercentage: 0,
        allowedUserIds: [],
        allowedTiers: [UserTier.GOLD],
        description: null,
        updatedAt: new Date(),
      },
    ]);

    await expect(
      service.isEnabledForUser('beta-dashboard', 'user-10', UserTier.GOLD),
    ).resolves.toBe(true);
  });

  it('uses deterministic rollout bucketing for percentage rollout', async () => {
    repository.findAll.mockResolvedValue([
      {
        key: 'beta-dashboard',
        isEnabled: true,
        rolloutPercentage: 25,
        allowedUserIds: [],
        allowedTiers: [],
        description: null,
        updatedAt: new Date(),
      },
    ]);

    const first = await service.isEnabledForUser('beta-dashboard', 'user-rollout');
    cache.values.clear();
    const second = await service.isEnabledForUser('beta-dashboard', 'user-rollout');

    expect(first).toBe(second);
  });

  it('persists updates and emits a cache invalidation event', async () => {
    repository.findByKey.mockResolvedValue(null);

    const saved = await service.setFlag('beta-dashboard', {
      isEnabled: true,
      rolloutPercentage: 50,
      allowedUserIds: ['user-1'],
      allowedTiers: [UserTier.BLACK],
      description: 'test flag',
    });

    expect(repository.save).toHaveBeenCalled();
    expect(events.emitChanged).toHaveBeenCalledWith({ key: 'beta-dashboard' });
    expect(saved.isEnabled).toBe(true);
    expect(saved.rolloutPercentage).toBe(50);
  });
});
