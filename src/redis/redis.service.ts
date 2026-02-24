// src/redis/redis.service.ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis;

  constructor(private configService: ConfigService) {
    this.client = new Redis({
      host: this.configService.get('REDIS_HOST'),
      port: this.configService.get('REDIS_PORT'),
      password: this.configService.get('REDIS_PASSWORD'),
    });
  }

  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.set(key, value, 'EX', ttl);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  // Backward-compatible alias.
  async delete(key: string): Promise<boolean> {
    await this.del(key);
    return true;
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async ping(): Promise<string> {
    return await this.client.ping();
  }

  async info(section?: string): Promise<string> {
    if (section) {
      return await this.client.info(section);
    }
    return await this.client.info();
  }

  async isHealthy(): Promise<boolean> {
    try {
      const pong = await this.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
