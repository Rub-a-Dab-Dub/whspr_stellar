import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private client: RedisClientType;
  private isConnected = false;
  private metrics = { hits: 0, misses: 0 };

  constructor(private configService: ConfigService) {
    this.initRedis();
  }

  private async initRedis() {
    try {
      this.client = createClient({
        socket: {
          host: this.configService.get('REDIS_HOST', 'localhost'),
          port: this.configService.get('REDIS_PORT', 6379),
        },
        password: this.configService.get('REDIS_PASSWORD'),
      });

      this.client.on('error', (err) => {
        this.logger.warn(`Redis error: ${err.message}`);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log('Redis connected');
      });

      await this.client.connect();
    } catch (error) {
      this.logger.warn(`Redis init failed: ${error.message}`);
      this.isConnected = false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) {
      this.logger.warn('Redis unavailable, bypassing cache');
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (value) {
        this.metrics.hits++;
        return JSON.parse(value);
      }
      this.metrics.misses++;
      return null;
    } catch (error) {
      this.logger.warn(`Cache get error: ${error.message}`);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn('Redis unavailable, bypassing cache');
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      this.logger.warn(`Cache set error: ${error.message}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.warn(`Cache del error: ${error.message}`);
    }
  }

  async delByPrefix(prefix: string): Promise<void> {
    if (!this.isConnected) return;

    try {
      const keys = await this.client.keys(`${prefix}*`);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      this.logger.warn(`Cache delByPrefix error: ${error.message}`);
    }
  }

  async setWithTags(key: string, value: any, tags: string[], ttlSeconds?: number): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.set(key, value, ttlSeconds);
      
      const pipeline = this.client.multi();
      for (const tag of tags) {
        pipeline.sAdd(`tag:${tag}`, key);
        if (ttlSeconds) {
          pipeline.expire(`tag:${tag}`, ttlSeconds);
        }
      }
      await pipeline.exec();
    } catch (error) {
      this.logger.warn(`Cache setWithTags error: ${error.message}`);
    }
  }

  async invalidateByTag(tag: string): Promise<void> {
    if (!this.isConnected) return;

    try {
      const keys = await this.client.sMembers(`tag:${tag}`);
      if (keys.length > 0) {
        const pipeline = this.client.multi();
        keys.forEach((key) => pipeline.del(key));
        pipeline.del(`tag:${tag}`);
        await pipeline.exec();
      }
    } catch (error) {
      this.logger.warn(`Cache invalidateByTag error: ${error.message}`);
    }
  }

  getMetrics() {
    return { ...this.metrics };
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }
}
