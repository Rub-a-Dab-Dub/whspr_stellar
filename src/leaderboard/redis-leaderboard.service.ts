import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { LeaderboardType, LeaderboardPeriod } from './entities/leaderboard-entry.entity';
import * as redis from 'redis';

@Injectable()
export class RedisLeaderboardService {
  private readonly logger = new Logger(RedisLeaderboardService.name);
  private redisClient: redis.RedisClientType;

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {
    // Extract Redis client from cache manager
    this.initializeRedisClient();
  }

  private async initializeRedisClient(): Promise<void> {
    try {
      const store = (this.cacheManager as any).store;
      if (store && store.client) {
        this.redisClient = store.client;
      }
    } catch (error) {
      this.logger.warn('Could not initialize Redis client from cache manager');
    }
  }

  /**
   * Generate a Redis sorted set key for a leaderboard
   */
  private getLeaderboardKey(
    boardType: LeaderboardType,
    period: LeaderboardPeriod,
  ): string {
    return `leaderboard:${boardType}:${period}`;
  }

  /**
   * Add or update a user's score in the sorted set (ZADD)
   */
  async addScore(
    boardType: LeaderboardType,
    period: LeaderboardPeriod,
    userId: string,
    score: number,
  ): Promise<void> {
    try {
      const key = this.getLeaderboardKey(boardType, period);
      await this.redisClient.zAdd(key, { score, member: userId });
      this.logger.debug(
        `Added score for ${userId} on ${boardType}/${period}: ${score}`,
      );
    } catch (error) {
      this.logger.error(
        `Error adding score to Redis: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Increment a user's score in the sorted set (ZINCRBY)
   */
  async incrementScore(
    boardType: LeaderboardType,
    period: LeaderboardPeriod,
    userId: string,
    deltaScore: number,
  ): Promise<number> {
    try {
      const key = this.getLeaderboardKey(boardType, period);
      const result = await this.redisClient.zIncrBy(
        key,
        deltaScore,
        userId,
      );
      this.logger.debug(
        `Incremented score for ${userId} by ${deltaScore}, new score: ${result}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error incrementing score in Redis: ${(error as Error).message}`,
      );
      return 0;
    }
  }

  /**
   * Get a user's rank in the leaderboard (ZREVRANK - highest score = rank 1)
   */
  async getUserRank(
    boardType: LeaderboardType,
    period: LeaderboardPeriod,
    userId: string,
  ): Promise<number | null> {
    try {
      const key = this.getLeaderboardKey(boardType, period);
      const rank = await this.redisClient.zRevRank(key, userId);
      // Redis returns 0-based index, convert to 1-based rank
      return rank !== null ? rank + 1 : null;
    } catch (error) {
      this.logger.error(
        `Error getting user rank from Redis: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Get a user's score
   */
  async getUserScore(
    boardType: LeaderboardType,
    period: LeaderboardPeriod,
    userId: string,
  ): Promise<number | null> {
    try {
      const key = this.getLeaderboardKey(boardType, period);
      const score = await this.redisClient.zScore(key, userId);
      return score;
    } catch (error) {
      this.logger.error(
        `Error getting user score from Redis: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Get top N users from leaderboard (ZREVRANGE)
   */
  async getTopUsers(
    boardType: LeaderboardType,
    period: LeaderboardPeriod,
    limit: number = 100,
  ): Promise<Array<{ userId: string; score: number; rank: number }>> {
    try {
      const key = this.getLeaderboardKey(boardType, period);
      const topLimit = Math.min(limit, 500);

      const results = await this.redisClient.zRevRangeByScoreWithScores(
        key,
        '+inf',
        '-inf',
        { LIMIT: { offset: 0, count: topLimit } },
      );

      return results.map((item, index) => ({
        userId: item.member,
        score: item.score,
        rank: index + 1,
      }));
    } catch (error) {
      this.logger.error(
        `Error getting top users from Redis: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Get nearby users around a given rank (for context)
   */
  async getNearbyUsers(
    boardType: LeaderboardType,
    period: LeaderboardPeriod,
    rank: number,
    range: number = 5,
  ): Promise<Array<{ userId: string; score: number; rank: number }>> {
    try {
      const key = this.getLeaderboardKey(boardType, period);
      const startIndex = Math.max(0, rank - range - 1); // -1 because rank is 1-based
      const endIndex = rank + range - 1;

      const results = await this.redisClient.zRevRange(key, startIndex, endIndex, {
        WITHSCORES: true,
      });

      // Convert to array of objects
      const users: Array<{ userId: string; score: number; rank: number }> = [];
      for (let i = 0; i < results.length; i += 2) {
        users.push({
          userId: results[i],
          score: parseFloat(results[i + 1]),
          rank: startIndex + Math.floor(i / 2) + 1,
        });
      }

      return users;
    } catch (error) {
      this.logger.error(
        `Error getting nearby users from Redis: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Get total number of users in leaderboard (ZCARD)
   */
  async getTotalCount(
    boardType: LeaderboardType,
    period: LeaderboardPeriod,
  ): Promise<number> {
    try {
      const key = this.getLeaderboardKey(boardType, period);
      return await this.redisClient.zCard(key);
    } catch (error) {
      this.logger.error(
        `Error getting total count from Redis: ${(error as Error).message}`,
      );
      return 0;
    }
  }

  /**
   * Get all users with their scores (for backup/sync)
   */
  async getAllUsersWithScores(
    boardType: LeaderboardType,
    period: LeaderboardPeriod,
  ): Promise<Array<{ userId: string; score: number; rank: number }>> {
    try {
      const key = this.getLeaderboardKey(boardType, period);
      const results = await this.redisClient.zRevRangeByScoreWithScores(
        key,
        '+inf',
        '-inf',
      );

      return results.map((item, index) => ({
        userId: item.member,
        score: item.score,
        rank: index + 1,
      }));
    } catch (error) {
      this.logger.error(
        `Error getting all users from Redis: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Clear entire leaderboard (for reset operations)
   */
  async clearLeaderboard(
    boardType: LeaderboardType,
    period: LeaderboardPeriod,
  ): Promise<void> {
    try {
      const key = this.getLeaderboardKey(boardType, period);
      await this.redisClient.del(key);
      this.logger.log(`Cleared leaderboard for ${boardType}/${period}`);
    } catch (error) {
      this.logger.error(
        `Error clearing leaderboard from Redis: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Remove a user from leaderboard
   */
  async removeUser(
    boardType: LeaderboardType,
    period: LeaderboardPeriod,
    userId: string,
  ): Promise<void> {
    try {
      const key = this.getLeaderboardKey(boardType, period);
      await this.redisClient.zRem(key, userId);
      this.logger.debug(`Removed user ${userId} from ${boardType}/${period}`);
    } catch (error) {
      this.logger.error(
        `Error removing user from Redis: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Get leaderboard cache key
   */
  getCacheKey(
    boardType: LeaderboardType,
    period: LeaderboardPeriod,
  ): string {
    return `cache:leaderboard:${boardType}:${period}`;
  }

  /**
   * Set leaderboard cache with TTL (30 seconds)
   */
  async setCachedLeaderboard(
    boardType: LeaderboardType,
    period: LeaderboardPeriod,
    data: any,
    ttlSeconds: number = 30,
  ): Promise<void> {
    try {
      const key = this.getCacheKey(boardType, period);
      await this.cacheManager.set(key, data, ttlSeconds * 1000);
      this.logger.debug(
        `Cached leaderboard for ${boardType}/${period} with TTL ${ttlSeconds}s`,
      );
    } catch (error) {
      this.logger.error(
        `Error setting leaderboard cache: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Get cached leaderboard
   */
  async getCachedLeaderboard(
    boardType: LeaderboardType,
    period: LeaderboardPeriod,
  ): Promise<any | null> {
    try {
      const key = this.getCacheKey(boardType, period);
      return await this.cacheManager.get(key);
    } catch (error) {
      this.logger.error(
        `Error getting leaderboard cache: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Invalidate leaderboard cache
   */
  async invalidateCache(
    boardType: LeaderboardType,
    period: LeaderboardPeriod,
  ): Promise<void> {
    try {
      const key = this.getCacheKey(boardType, period);
      await this.cacheManager.del(key);
      this.logger.debug(
        `Invalidated cache for leaderboard ${boardType}/${period}`,
      );
    } catch (error) {
      this.logger.error(
        `Error invalidating leaderboard cache: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Bulk load scores from database to Redis (for initialization/recovery)
   */
  async bulkLoadScores(
    boardType: LeaderboardType,
    period: LeaderboardPeriod,
    users: Array<{ userId: string; score: number }>,
  ): Promise<void> {
    try {
      if (users.length === 0) return;

      const key = this.getLeaderboardKey(boardType, period);
      const zadd = users.map(u => ({ member: u.userId, score: u.score }));

      await this.redisClient.zAdd(key, zadd);
      this.logger.log(
        `Bulk loaded ${users.length} users to ${boardType}/${period}`,
      );
    } catch (error) {
      this.logger.error(
        `Error bulk loading scores to Redis: ${(error as Error).message}`,
      );
    }
  }
}
