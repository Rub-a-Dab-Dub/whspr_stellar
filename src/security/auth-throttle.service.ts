import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

const AUTH_FAIL_PREFIX = 'auth_fail:';

@Injectable()
export class AuthThrottleService {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: any) {}

  async recordFailedAttempt(ip: string): Promise<number> {
    const key = `${AUTH_FAIL_PREFIX}${ip}`;
    const current: number = (await this.cacheManager.get(key)) || 0;
    const next = current + 1;
    await this.cacheManager.set(key, next, 15 * 60 * 1000); // 15 min window
    return next;
  }

  async getDelayMs(ip: string): Promise<number> {
    const key = `${AUTH_FAIL_PREFIX}${ip}`;
    const failures: number = (await this.cacheManager.get(key)) || 0;
    if (failures <= 3) return 0;
    // Progressive delay: 1s, 2s, 4s, 8s, max 30s
    return Math.min(1000 * Math.pow(2, failures - 4), 30000);
  }

  async resetAttempts(ip: string): Promise<void> {
    await this.cacheManager.del(`${AUTH_FAIL_PREFIX}${ip}`);
  }
}
