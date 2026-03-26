import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { CacheMetricsService } from './cache-metrics.service';
import { RedlockService } from './redlock.service';
import { CACHE_TTL, lockKey } from './cache.constants';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    private readonly redis: Redis,
    private readonly metrics: CacheMetricsService,
    private readonly redlock: RedlockService,
  ) {}

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /** Extract the first segment of a key for metric labelling (e.g. "user" from "user:123"). */
  private prefix(key: string): string {
    return key.split(':')[0] ?? key;
  }

  // ─── Core operations ─────────────────────────────────────────────────────────

  /**
   * Get a typed value from cache.
   * Returns `null` on miss OR on Redis failure (graceful degradation).
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      if (raw === null) {
        this.metrics.recordMiss(this.prefix(key));
        return null;
      }
      this.metrics.recordHit(this.prefix(key));
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.error(`cache.get failed for key "${key}": ${(err as Error).message}`);
      this.metrics.recordError('get');
      return null; // graceful degradation — caller falls back to DB
    }
  }

  /**
   * Store a value in cache with a TTL (seconds).
   * Silently swallows Redis errors so callers never crash.
   */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      this.logger.error(`cache.set failed for key "${key}": ${(err as Error).message}`);
      this.metrics.recordError('set');
    }
  }

  /** Delete a single cache key. */
  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.error(`cache.del failed for key "${key}": ${(err as Error).message}`);
      this.metrics.recordError('del');
    }
  }

  /**
   * Invalidate all keys matching a glob pattern (e.g. `"user:123:*"`).
   * Uses SCAN to avoid blocking Redis with KEYS in production.
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = next;
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } while (cursor !== '0');
    } catch (err) {
      this.logger.error(`cache.invalidatePattern failed for "${pattern}": ${(err as Error).message}`);
      this.metrics.recordError('invalidate_pattern');
    }
  }

  /**
   * Invalidate a set of exact keys in one call.
   */
  async invalidateMany(keys: string[]): Promise<void> {
    if (!keys.length) return;
    try {
      await this.redis.del(...keys);
    } catch (err) {
      this.logger.error(`cache.invalidateMany failed: ${(err as Error).message}`);
      this.metrics.recordError('invalidate_many');
    }
  }

  // ─── Stampede-safe cache-aside ────────────────────────────────────────────────

  /**
   * Get a value from cache.  On miss, acquire a distributed lock, then call
   * `fetcher` exactly once (other waiters re-check cache after lock releases).
   *
   * Gracefully degrades: if Redis is down the fetcher is always called.
   *
   * @param key        Cache key
   * @param ttl        TTL in seconds (from CACHE_TTL)
   * @param fetcher    Async function that loads the value from the DB / upstream
   */
  async getOrSet<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
    // 1. Fast path — cache hit
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    // 2. Acquire distributed lock to prevent stampede
    const resource = lockKey(key);
    return this.redlock.withLock(resource, 5_000, async () => {
      // 3. Re-check after acquiring lock (another worker may have populated it)
      const recheck = await this.get<T>(key);
      if (recheck !== null) return recheck;

      // 4. Load from source and populate cache
      const value = await fetcher();
      await this.set(key, value, ttl);
      return value;
    });
  }

  // ─── Entity mutation hooks ────────────────────────────────────────────────────

  /** Call after any user mutation to invalidate all user-scoped cache entries. */
  async onUserMutated(userId: string): Promise<void> {
    await this.invalidatePattern(`user:${userId}:*`);
    await this.del(`user:${userId}`);
  }

  /** Call after any wallet mutation. */
  async onWalletMutated(userId: string): Promise<void> {
    await this.del(`wallet:${userId}`);
  }

  /** Call after any conversation mutation. */
  async onConversationMutated(conversationId: string): Promise<void> {
    await this.invalidatePattern(`conversation:${conversationId}:*`);
    await this.del(`conversation:${conversationId}`);
  }

  /** Call after group membership changes. */
  async onGroupMutated(groupId: string): Promise<void> {
    await this.del(`group:${groupId}:members`);
  }

  // ─── Utility ─────────────────────────────────────────────────────────────────

  /** Ping Redis — useful for health checks. */
  async ping(): Promise<boolean> {
    try {
      return (await this.redis.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  /** Expose TTL constants for use in other services. */
  get ttl() {
    return CACHE_TTL;
  }
}