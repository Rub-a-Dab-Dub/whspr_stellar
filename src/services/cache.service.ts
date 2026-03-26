import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

@Injectable()
export class CacheService {
  private hits = 0;
  private misses = 0;

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.cache.get<T>(key);
    if (value !== undefined && value !== null) {
      this.hits++;
      return value;
    }
    this.misses++;
    return null;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.cache.set(key, value, ttl);
  }

  async del(...keys: string[]): Promise<void> {
    await Promise.all(keys.map((k) => this.cache.del(k)));
  }

  /**
   * Get from cache or execute loader and cache the result.
   */
  async wrap<T>(key: string, loader: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await loader();
    await this.set(key, value, ttl);
    return value;
  }

  /** Warm cache by pre-loading a set of key/loader pairs. */
  async warm<T>(entries: { key: string; loader: () => Promise<T>; ttl?: number }[]): Promise<void> {
    await Promise.all(entries.map(({ key, loader, ttl }) => this.wrap(key, loader, ttl)));
  }

  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? 0 : Math.round((this.hits / total) * 100) / 100,
    };
  }

  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }
}
