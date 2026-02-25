import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { RedisService } from './redis.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redis: RedisService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const isUp = await this.redis.ping();
    const result = this.getStatus(key, isUp, isUp ? { ping: 'pong' } : { error: 'Redis ping failed' });
    if (!isUp) {
      throw new HealthCheckError('Redis check failed', result);
    }
    return result;
  }
}
