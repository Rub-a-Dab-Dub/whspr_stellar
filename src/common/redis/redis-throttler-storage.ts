import { Injectable } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage.interface';
import Redis from 'ioredis';

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: Redis) {}

  async increment(key: string, ttl: number): Promise<ThrottlerStorageRecord> {
    const now = Date.now();
    const windowStart = now - ttl;
    const redisKey = `throttler:${key}`;

    const multi = this.redis.multi();
    multi.zremrangebyscore(redisKey, 0, windowStart);
    multi.zadd(redisKey, now, now.toString());
    multi.zcard(redisKey);
    multi.expire(redisKey, Math.ceil(ttl / 1000) + 1);

    const results = await multi.exec();
    if (!results) {
      throw new Error('Redis multi-exec failed');
    }
    
    // results[2] contains the ZCARD result: [null, count]
    const totalHits = (results[2][1] as number) || 0;

    return {
      totalHits,
      timeToExpire: Math.ceil(ttl / 1000),
    };
  }
}
