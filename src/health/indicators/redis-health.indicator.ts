import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redisService: RedisService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();

    try {
      const isHealthy = await this.redisService.isHealthy();
      const responseTime = Date.now() - startTime;

      if (isHealthy) {
        return this.getStatus(key, true, {
          message: 'Redis is up and running',
          responseTime: `${responseTime}ms`,
        });
      }

      throw new HealthCheckError(
        'Redis health check failed',
        this.getStatus(key, false, {
          message: 'Redis is not responding',
          responseTime: `${responseTime}ms`,
        }),
      );
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      throw new HealthCheckError(
        'Redis health check failed',
        this.getStatus(key, false, {
          message: error?.message || 'Redis connection error',
          responseTime: `${responseTime}ms`,
        }),
      );
    }
  }
}
