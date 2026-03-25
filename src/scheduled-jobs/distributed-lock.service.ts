import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import Redlock from 'redlock';

@Injectable()
export class DistributedLockService implements OnModuleDestroy {
  private readonly logger = new Logger(DistributedLockService.name);
  private readonly redisClient: Redis;
  private readonly redlock: Redlock;

  constructor(private readonly configService: ConfigService) {
    this.redisClient = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
      db: this.configService.get<number>('REDIS_DB', 0),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    this.redlock = new Redlock([this.redisClient], {
      retryCount: 0,
    });
  }

  async runWithLock(
    lockName: string,
    ttlMs: number,
    fn: () => Promise<void>,
  ): Promise<{ executed: boolean }> {
    const resource = `locks:scheduled-jobs:${lockName}`;

    try {
      await this.redlock.using([resource], ttlMs, async () => {
        await fn();
      });

      return { executed: true };
    } catch (error) {
      if (error instanceof Error && error.name === 'ExecutionError') {
        this.logger.warn(`Lock not acquired for job "${lockName}"`);
        return { executed: false };
      }

      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redisClient.quit();
    } catch {
      await this.redisClient.disconnect();
    }
  }
}
