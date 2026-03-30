import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { CacheService } from '../src/cache/cache.service';
import { AdminGuard } from '../src/auth/guards/admin.guard';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { UserTier } from '../src/users/entities/user.entity';
import { FeatureFlag } from '../src/feature-flags/entities/feature-flag.entity';
import { FeatureFlagsCacheListener } from '../src/feature-flags/feature-flags-cache.listener';
import { FeatureFlagsController } from '../src/feature-flags/feature-flags.controller';
import { FeatureFlagsEvents } from '../src/feature-flags/feature-flags.events';
import { FeatureFlagsRepository } from '../src/feature-flags/feature-flags.repository';
import { FeatureFlagsService } from '../src/feature-flags/feature-flags.service';

class MockJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    request.user = { id: 'user-1', tier: UserTier.GOLD };
    return true;
  }
}

class MockAdminGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}

describe('FeatureFlagsController (e2e)', () => {
  let app: INestApplication;
  const flags = new Map<string, FeatureFlag>();
  const cache = new Map<string, unknown>();

  beforeEach(async () => {
    flags.clear();
    cache.clear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [FeatureFlagsController],
      providers: [
        FeatureFlagsService,
        FeatureFlagsCacheListener,
        FeatureFlagsEvents,
        {
          provide: FeatureFlagsRepository,
          useValue: {
            findAll: jest.fn(async () =>
              [...flags.values()].sort((a, b) => a.key.localeCompare(b.key)),
            ),
            findByKey: jest.fn(async (key: string) => flags.get(key) ?? null),
            create: jest.fn((value: Partial<FeatureFlag>) => value),
            save: jest.fn(async (value: Partial<FeatureFlag>) => {
              if (!value.key) {
                throw new Error('Feature flag key is required');
              }

              const saved = {
                ...value,
                updatedAt: new Date('2026-01-01T00:00:00.000Z'),
              } as FeatureFlag;
              flags.set(value.key, saved);
              return saved;
            }),
          },
        },
        {
          provide: CacheService,
          useValue: {
            getOrSet: jest.fn(async (key, _ttl, fetcher) => {
              if (cache.has(key)) {
                return cache.get(key);
              }

              const value = await fetcher();
              cache.set(key, value);
              return value;
            }),
            invalidateMany: jest.fn(async (keys: string[]) => {
              keys.forEach((key) => cache.delete(key));
            }),
            invalidatePattern: jest.fn(async (pattern: string) => {
              const prefix = pattern.replace('*', '');
              [...cache.keys()]
                .filter((key) => key.startsWith(prefix))
                .forEach((key) => cache.delete(key));
            }),
          },
        },
        { provide: JwtAuthGuard, useClass: MockJwtGuard },
        { provide: AdminGuard, useClass: MockAdminGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('lists admin feature flags', async () => {
    flags.set('beta-dashboard', {
      key: 'beta-dashboard',
      isEnabled: true,
      rolloutPercentage: 100,
      allowedUserIds: [],
      allowedTiers: [],
      description: 'beta',
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const response = await request(app.getHttpServer()).get('/admin/feature-flags').expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].key).toBe('beta-dashboard');
  });

  it('creates or updates a feature flag from the admin endpoint', async () => {
    const response = await request(app.getHttpServer())
      .patch('/admin/feature-flags/beta-dashboard')
      .send({
        isEnabled: true,
        rolloutPercentage: 100,
        allowedTiers: [UserTier.GOLD],
        description: 'beta',
      })
      .expect(200);

    expect(response.body.key).toBe('beta-dashboard');
    expect(response.body.allowedTiers).toEqual([UserTier.GOLD]);
  });

  it('resolves current-user feature flags', async () => {
    flags.set('beta-dashboard', {
      key: 'beta-dashboard',
      isEnabled: true,
      rolloutPercentage: 0,
      allowedUserIds: [],
      allowedTiers: [UserTier.GOLD],
      description: 'beta',
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const response = await request(app.getHttpServer()).get('/feature-flags/me').expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({
        key: 'beta-dashboard',
        enabled: true,
      }),
    ]);
  });
});
