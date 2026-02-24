import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.cacheManager.get<T>(key);
      if (value) {
        this.logger.debug(`Cache hit for key: ${key}`);
      } else {
        this.logger.debug(`Cache miss for key: ${key}`);
      }
      return value || null;
    } catch (error) {
      this.logger.error(`Error getting cache key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a value in cache with optional TTL
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Time to live in seconds (optional)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttl ? ttl * 1000 : undefined);
      this.logger.debug(
        `Cache set for key: ${key}${ttl ? ` with TTL: ${ttl}s` : ''}`,
      );
    } catch (error) {
      this.logger.error(`Error setting cache key ${key}:`, error);
    }
  }

  /**
   * Delete a specific key from cache
   */
  async delete(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      this.logger.debug(`Cache deleted for key: ${key}`);
    } catch (error) {
      this.logger.error(`Error deleting cache key ${key}:`, error);
    }
  }

  // Backward-compatible alias.
  async del(key: string): Promise<void> {
    await this.delete(key);
  }

  /**
   * Delete multiple keys matching a pattern
   * Note: This requires direct Redis access for pattern matching
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      // This is a simplified version - for production, you'd need to access Redis directly
      this.logger.warn(
        `Pattern deletion not fully implemented for pattern: ${pattern}`,
      );
      // Implementation would require accessing the Redis store directly
    } catch (error) {
      this.logger.error(`Error deleting cache pattern ${pattern}:`, error);
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      // Note: cache-manager v5+ doesn't have reset(), use store-specific methods if needed
      this.logger.warn(
        'Cache clear operation not fully implemented - requires direct Redis access',
      );
      // For full implementation, you would need to access the Redis store directly
    } catch (error) {
      this.logger.error('Error clearing cache:', error);
    }
  }

  /**
   * Wrap a function with caching
   * If the key exists in cache, return cached value
   * Otherwise, execute the function, cache the result, and return it
   */
  async wrap<T>(key: string, fn: () => Promise<T>, ttl?: number): Promise<T> {
    try {
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      const result = await fn();
      await this.set(key, result, ttl);
      return result;
    } catch (error) {
      this.logger.error(`Error in cache wrap for key ${key}:`, error);
      // If caching fails, still execute the function
      return fn();
    }
  }
}
