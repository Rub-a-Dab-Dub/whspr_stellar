import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModerationAction } from '../entities/moderation-action.entity';

interface RateLimitConfig {
  maxMessages: number;
  windowMs: number; // time window in milliseconds
}

@Injectable()
export class RateLimiterService {
  private userMessageCache: Map<string, number[]> = new Map();

  constructor(
    @InjectRepository(ModerationAction)
    private moderationActionRepo: Repository<ModerationAction>,
  ) {}

  /**
   * Check if user exceeded rate limit
   */
  async checkRateLimit(
    userId: string,
    roomId: string,
    config: RateLimitConfig,
  ): Promise<{ limited: boolean; remainingMessages: number }> {
    const key = `${userId}:${roomId}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Get user's message timestamps
    let timestamps = this.userMessageCache.get(key) || [];

    // Remove old timestamps outside the window
    timestamps = timestamps.filter((ts) => ts > windowStart);

    // Check if limit exceeded
    const limited = timestamps.length >= config.maxMessages;
    const remainingMessages = Math.max(
      0,
      config.maxMessages - timestamps.length,
    );

    // Add current timestamp if not limited
    if (!limited) {
      timestamps.push(now);
      this.userMessageCache.set(key, timestamps);
    }

    return { limited, remainingMessages };
  }

  /**
   * Reset rate limit for user in room
   */
  resetRateLimit(userId: string, roomId: string): void {
    const key = `${userId}:${roomId}`;
    this.userMessageCache.delete(key);
  }

  /**
   * Clear old cache entries (run periodically)
   */
  clearOldCache(maxAgeMs: number = 3600000): void {
    const now = Date.now();
    for (const [key, timestamps] of this.userMessageCache.entries()) {
      const recentTimestamps = timestamps.filter((ts) => now - ts < maxAgeMs);
      if (recentTimestamps.length === 0) {
        this.userMessageCache.delete(key);
      } else {
        this.userMessageCache.set(key, recentTimestamps);
      }
    }
  }
}
