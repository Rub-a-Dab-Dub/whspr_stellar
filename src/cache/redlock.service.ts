import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import Redlock, { Lock } from 'redlock';

@Injectable()
export class RedlockService implements OnModuleDestroy {
  private readonly logger = new Logger(RedlockService.name);
  private readonly redlock: Redlock;

  constructor(private readonly redis: Redis) {
    this.redlock = new Redlock([this.redis], {
      /** Time in ms between retry attempts */
      retryDelay: 200,
      /** Max number of retries before giving up */
      retryCount: 10,
      /** Max time in ms randomly added to retries to improve performance under high contention */
      retryJitter: 200,
      /** Minimum remaining TTL before auto-extending (ms) */
      automaticExtensionThreshold: 500,
    });

    this.redlock.on('error', (err) => {
      // Suppress "lock already acquired" noise; log everything else
      if (!err.message?.includes('not be acquired')) {
        this.logger.warn(`Redlock error: ${err.message}`);
      }
    });
  }

  /**
   * Acquire a distributed lock for `resource`.
   * @param resource  Unique lock identifier (e.g. `lock:user:123`)
   * @param ttl       Lock TTL in milliseconds (default 5 s)
   */
  async acquire(resource: string, ttl = 5_000): Promise<Lock | null> {
    try {
      return await this.redlock.acquire([resource], ttl);
    } catch {
      this.logger.warn(`Could not acquire lock for "${resource}"`);
      return null;
    }
  }

  /** Release a previously acquired lock. Safe to call with null. */
  async release(lock: Lock | null): Promise<void> {
    if (!lock) return;
    try {
      await lock.release();
    } catch (err) {
      this.logger.warn(`Failed to release lock: ${(err as Error).message}`);
    }
  }

  /**
   * Execute `fn` while holding a distributed lock.
   * If the lock cannot be acquired, `fn` is still executed (graceful degradation).
   */
  async withLock<T>(resource: string, ttl: number, fn: () => Promise<T>): Promise<T> {
    const lock = await this.acquire(resource, ttl);
    try {
      return await fn();
    } finally {
      await this.release(lock);
    }
  }

  onModuleDestroy() {
    this.redlock.quit().catch(() => undefined);
  }
}