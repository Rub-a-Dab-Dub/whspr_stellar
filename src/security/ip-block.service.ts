import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

const IP_BLOCK_PREFIX = 'blocked_ip:';

@Injectable()
export class IpBlockService {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: any) {}

  async blockIp(ip: string): Promise<void> {
    await this.cacheManager.set(`${IP_BLOCK_PREFIX}${ip}`, true, 0);
  }

  async unblockIp(ip: string): Promise<void> {
    await this.cacheManager.del(`${IP_BLOCK_PREFIX}${ip}`);
  }

  async isBlocked(ip: string): Promise<boolean> {
    const val = await this.cacheManager.get(`${IP_BLOCK_PREFIX}${ip}`);
    return val === true;
  }
}
