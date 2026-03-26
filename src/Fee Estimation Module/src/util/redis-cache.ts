import Redis from 'ioredis';

export class RedisCache {
  client: Redis;
  ttlSeconds = 15;

  constructor() {
    // Use default localhost for simplicity; in production inject config
    this.client = new Redis();
  }

  async get<T>(key: string): Promise<T | null> {
    const v = await this.client.get(key);
    if (!v) return null;
    return JSON.parse(v) as T;
  }

  async set(key: string, val: any, ttlSec?: number) {
    const ttl = ttlSec ?? this.ttlSeconds;
    await this.client.set(key, JSON.stringify(val), 'EX', ttl);
  }
}
