import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly redisClient: Redis;

  constructor(private readonly configService: ConfigService) {
    this.redisClient = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
      db: this.configService.get<number>('REDIS_DB', 0),
    });

    this.redisClient.on('connect', () => {
      this.logger.log('Redis connected successfully');
    });

    this.redisClient.on('error', (err: Error) => {
      this.logger.error('Redis connection error:', err);
    });
  }

  getClient(): Redis {
    return this.redisClient;
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redisClient.quit();
    } catch {
      await this.redisClient.disconnect();
    }
  }
}
