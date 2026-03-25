import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const client = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
      db: this.configService.get<number>('REDIS_DB', 0),
      lazyConnect: true,
      connectTimeout: 2000,
      maxRetriesPerRequest: 1,
    });

    try {
      await client.connect();
      const pong = await client.ping();
      if (pong !== 'PONG') {
        throw new Error('Unexpected Redis ping response');
      }
      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError(
        'Redis readiness check failed',
        this.getStatus(key, false, {
          message: error instanceof Error ? error.message : 'Unknown Redis error',
        }),
      );
    } finally {
      client.disconnect();
    }
  }
}
