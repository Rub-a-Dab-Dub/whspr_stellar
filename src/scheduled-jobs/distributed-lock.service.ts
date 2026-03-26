import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import Redlock from 'redlock';
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class DistributedLockService {
  private readonly logger = new Logger(DistributedLockService.name);
  private readonly redlock: Redlock;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    const redisClient = this.redisService.getClient();
    this.redlock = new Redlock([redisClient], {
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

}
