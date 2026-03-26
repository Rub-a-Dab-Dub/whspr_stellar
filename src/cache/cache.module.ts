import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { Registry } from 'prom-client';
import Redis from 'ioredis';
import { CacheService } from './cache.service';
import { CacheMetricsService } from './cache-metrics.service';
import { CacheWarmerService } from './cache-warmer.service';
import { RedlockService } from './redlock.service';

/**
 * Global CacheModule
 *
 * Provides:
 *   - A shared ioredis client (`REDIS_CLIENT` token)
 *   - CacheService  — typed get/set/del/invalidate with namespace helpers
 *   - RedlockService — distributed locking (cache stampede prevention)
 *   - CacheMetricsService — Prometheus hit/miss/error counters
 *   - CacheWarmerService — populates hot data on startup
 *
 * Note on cache-manager v7:
 *   `cache-manager-redis-store` targets cache-manager v4.  This project uses
 *   cache-manager v7, which no longer has a first-class Redis store package.
 *   Instead, ioredis is injected directly into CacheService, giving us full
 *   control over TTLs, namespacing, SCAN-based invalidation, and error handling.
 *   The `@nestjs/cache-manager` import below keeps decorator-based (@CacheKey /
 *   @CacheTTL) caching working with the default in-memory store for endpoints
 *   that use those decorators.
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    // In-memory store for @nestjs/cache-manager decorators.
    // Swap to a keyv-redis store (e.g. @keyv/redis) here when required.
    NestCacheModule.register({ isGlobal: true }),
  ],
  providers: [
    // ── ioredis client ────────────────────────────────────────────────────────
    {
      provide: 'REDIS_CLIENT',
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const client = new Redis({
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          db: config.get<number>('REDIS_DB', 0),
          // Reconnect automatically — never throw on connection failure
          enableOfflineQueue: true,
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => Math.min(times * 100, 3_000),
          lazyConnect: false,
        });

        client.on('connect', () => console.log('[Redis] connected'));
        client.on('error', (err) => console.error('[Redis] error', err.message));

        return client;
      },
    },

    // ── Prometheus registry (shared with ObservabilityModule) ─────────────────
    {
      provide: Registry,
      useFactory: () => new Registry(),
    },

    // ── Feature services ─────────────────────────────────────────────────────
    {
      provide: CacheMetricsService,
      inject: [Registry],
      useFactory: (registry: Registry) => new CacheMetricsService(registry),
    },
    {
      provide: RedlockService,
      inject: ['REDIS_CLIENT'],
      useFactory: (redis: Redis) => new RedlockService(redis),
    },
    {
      provide: CacheService,
      inject: ['REDIS_CLIENT', CacheMetricsService, RedlockService],
      useFactory: (redis: Redis, metrics: CacheMetricsService, redlock: RedlockService) =>
        new CacheService(redis, metrics, redlock),
    },
    CacheWarmerService,
  ],
  exports: ['REDIS_CLIENT', CacheService, RedlockService, CacheMetricsService],
})
export class CacheModule {}