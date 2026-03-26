import { ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-ioredis-yet';
import type { CacheModuleOptions } from '@nestjs/cache-manager';

export const TTL = {
  SHORT: 60, // 1 min  — volatile data (leaderboards, online status)
  MEDIUM: 300, // 5 min  — semi-stable (user profiles)
  LONG: 3600, // 1 hr   — stable (room metadata)
  DAY: 86400, // 24 hr  — near-static (contract addresses)
} as const;

export const redisConfig = async (config: ConfigService): Promise<CacheModuleOptions> => ({
  store: await redisStore({
    host: config.get<string>('REDIS_HOST', 'localhost'),
    port: config.get<number>('REDIS_PORT', 6379),
    password: config.get<string>('REDIS_PASSWORD') || undefined,
    db: config.get<number>('REDIS_DB', 0),
    keyPrefix: 'whspr:',
  }),
  ttl: TTL.MEDIUM,
});
