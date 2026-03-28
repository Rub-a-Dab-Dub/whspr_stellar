import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { RedisLeaderboardService } from './redis-leaderboard.service';
import { LeaderboardType, LeaderboardPeriod } from './entities/leaderboard-entry.entity';
import * as redis from 'redis';

describe('RedisLeaderboardService', () => {
  let service: RedisLeaderboardService;
  let cacheManager: jest.Mocked<Cache>;
  let redisClient: jest.Mocked<redis.RedisClientType>;

  beforeEach(async () => {
    // Mock Redis client
    redisClient = {
      zAdd: jest.fn(),
      zIncrBy: jest.fn(),
      zRevRank: jest.fn(),
      zScore: jest.fn(),
      zRevRangeByScoreWithScores: jest.fn(),
      zRevRange: jest.fn(),
      zCard: jest.fn(),
      del: jest.fn(),
      zRem: jest.fn(),
    } as any;

    // Mock Cache Manager
    cacheManager = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      store: {
        client: redisClient,
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisLeaderboardService,
        {
          provide: CACHE_MANAGER,
          useValue: cacheManager,
        },
      ],
    }).compile();

    service = module.get<RedisLeaderboardService>(RedisLeaderboardService);
  });

  describe('addScore', () => {
    it('should add score to Redis sorted set', async () => {
      redisClient.zAdd.mockResolvedValue(undefined);

      await service.addScore(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        'user-1',
        1000,
      );

      expect(redisClient.zAdd).toHaveBeenCalledWith(
        'leaderboard:TRANSFER_VOLUME:WEEKLY',
        { score: 1000, member: 'user-1' },
      );
    });

    it('should handle all board types', async () => {
      redisClient.zAdd.mockResolvedValue(undefined);

      const boardTypes = Object.values(LeaderboardType);
      for (const boardType of boardTypes) {
        await service.addScore(boardType, LeaderboardPeriod.WEEKLY, 'user-1', 100);
        expect(redisClient.zAdd).toHaveBeenCalledWith(
          `leaderboard:${boardType}:WEEKLY`,
          expect.any(Object),
        );
      }
    });

    it('should handle all periods', async () => {
      redisClient.zAdd.mockResolvedValue(undefined);

      const periods = Object.values(LeaderboardPeriod);
      for (const period of periods) {
        await service.addScore(LeaderboardType.TRANSFER_VOLUME, period, 'user-1', 100);
        expect(redisClient.zAdd).toHaveBeenCalledWith(
          `leaderboard:TRANSFER_VOLUME:${period}`,
          expect.any(Object),
        );
      }
    });

    it('should handle Redis errors gracefully', async () => {
      redisClient.zAdd.mockRejectedValue(new Error('Redis connection lost'));

      await expect(
        service.addScore(
          LeaderboardType.TRANSFER_VOLUME,
          LeaderboardPeriod.WEEKLY,
          'user-1',
          1000,
        ),
      ).resolves.not.toThrow();
    });
  });

  describe('incrementScore', () => {
    it('should increment score in Redis sorted set', async () => {
      redisClient.zIncrBy.mockResolvedValue(1100);

      const result = await service.incrementScore(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        'user-1',
        100,
      );

      expect(result).toBe(1100);
      expect(redisClient.zIncrBy).toHaveBeenCalledWith(
        'leaderboard:TRANSFER_VOLUME:WEEKLY',
        100,
        'user-1',
      );
    });

    it('should handle negative delta', async () => {
      redisClient.zIncrBy.mockResolvedValue(900);

      const result = await service.incrementScore(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        'user-1',
        -100,
      );

      expect(result).toBe(900);
    });

    it('should return 0 on error', async () => {
      redisClient.zIncrBy.mockRejectedValue(new Error('Redis error'));

      const result = await service.incrementScore(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        'user-1',
        100,
      );

      expect(result).toBe(0);
    });
  });

  describe('getUserRank', () => {
    it('should return 1-based rank', async () => {
      redisClient.zRevRank.mockResolvedValue(0); // Redis returns 0-based

      const rank = await service.getUserRank(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        'user-1',
      );

      expect(rank).toBe(1);
    });

    it('should return null if user not in leaderboard', async () => {
      redisClient.zRevRank.mockResolvedValue(null);

      const rank = await service.getUserRank(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        'user-unknown',
      );

      expect(rank).toBeNull();
    });

    it('should handle different ranks', async () => {
      redisClient.zRevRank.mockResolvedValue(99); // 100th position (0-based)

      const rank = await service.getUserRank(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        'user-100',
      );

      expect(rank).toBe(100);
    });

    it('should handle Redis errors', async () => {
      redisClient.zRevRank.mockRejectedValue(new Error('Redis error'));

      const rank = await service.getUserRank(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        'user-1',
      );

      expect(rank).toBeNull();
    });
  });

  describe('getUserScore', () => {
    it('should return user score', async () => {
      redisClient.zScore.mockResolvedValue(1500);

      const score = await service.getUserScore(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        'user-1',
      );

      expect(score).toBe(1500);
    });

    it('should return null if user has no score', async () => {
      redisClient.zScore.mockResolvedValue(null);

      const score = await service.getUserScore(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        'user-unknown',
      );

      expect(score).toBeNull();
    });

    it('should handle Redis errors', async () => {
      redisClient.zScore.mockRejectedValue(new Error('Redis error'));

      const score = await service.getUserScore(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        'user-1',
      );

      expect(score).toBeNull();
    });

    it('should return zero score', async () => {
      redisClient.zScore.mockResolvedValue(0);

      const score = await service.getUserScore(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        'user-1',
      );

      expect(score).toBe(0);
    });
  });

  describe('getTopUsers', () => {
    it('should return top N users with scores and ranks', async () => {
      redisClient.zRevRangeByScoreWithScores.mockResolvedValue([
        { member: 'user-1', score: 5000 },
        { member: 'user-2', score: 4500 },
        { member: 'user-3', score: 4000 },
      ]);

      const users = await service.getTopUsers(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        10,
      );

      expect(users).toHaveLength(3);
      expect(users[0]).toEqual({
        userId: 'user-1',
        score: 5000,
        rank: 1,
      });
      expect(users[1]).toEqual({
        userId: 'user-2',
        score: 4500,
        rank: 2,
      });
      expect(users[2]).toEqual({
        userId: 'user-3',
        score: 4000,
        rank: 3,
      });
    });

    it('should cap limit to 500', async () => {
      redisClient.zRevRangeByScoreWithScores.mockResolvedValue([]);

      await service.getTopUsers(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        1000,
      );

      expect(redisClient.zRevRangeByScoreWithScores).toHaveBeenCalledWith(
        'leaderboard:TRANSFER_VOLUME:WEEKLY',
        '+inf',
        '-inf',
        { LIMIT: { offset: 0, count: 500 } },
      );
    });

    it('should use default limit of 100', async () => {
      redisClient.zRevRangeByScoreWithScores.mockResolvedValue([]);

      await service.getTopUsers(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
      );

      expect(redisClient.zRevRangeByScoreWithScores).toHaveBeenCalledWith(
        'leaderboard:TRANSFER_VOLUME:WEEKLY',
        '+inf',
        '-inf',
        { LIMIT: { offset: 0, count: 100 } },
      );
    });

    it('should return empty array on error', async () => {
      redisClient.zRevRangeByScoreWithScores.mockRejectedValue(
        new Error('Redis error'),
      );

      const users = await service.getTopUsers(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
      );

      expect(users).toEqual([]);
    });

    it('should return empty array if no users', async () => {
      redisClient.zRevRangeByScoreWithScores.mockResolvedValue([]);

      const users = await service.getTopUsers(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
      );

      expect(users).toEqual([]);
    });
  });

  describe('getNearbyUsers', () => {
    it('should return nearby users around a rank', async () => {
      redisClient.zRevRange.mockResolvedValue([
        'user-3',
        '3500',
        'user-4',
        '3400',
        'user-5',
        '3300',
      ]);

      const users = await service.getNearbyUsers(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        4, // rank 4
        2, // range
      );

      expect(users).toHaveLength(3);
      expect(users[0].userId).toBe('user-3');
      expect(users[0].rank).toBe(3);
    });

    it('should use default range of 5', async () => {
      redisClient.zRevRange.mockResolvedValue([]);

      await service.getNearbyUsers(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        10,
      );

      expect(redisClient.zRevRange).toHaveBeenCalledWith(
        'leaderboard:TRANSFER_VOLUME:WEEKLY',
        4, // max(0, 10 - 5 - 1)
        14, // 10 + 5 - 1
        { WITHSCORES: true },
      );
    });

    it('should handle rank at boundary', async () => {
      redisClient.zRevRange.mockResolvedValue([]);

      await service.getNearbyUsers(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        1, // rank 1
        5,
      );

      expect(redisClient.zRevRange).toHaveBeenCalledWith(
        'leaderboard:TRANSFER_VOLUME:WEEKLY',
        0, // max(0, 1 - 5 - 1)
        5, // 1 + 5 - 1
        { WITHSCORES: true },
      );
    });

    it('should return empty array on error', async () => {
      redisClient.zRevRange.mockRejectedValue(new Error('Redis error'));

      const users = await service.getNearbyUsers(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        5,
      );

      expect(users).toEqual([]);
    });

    it('should handle empty result', async () => {
      redisClient.zRevRange.mockResolvedValue([]);

      const users = await service.getNearbyUsers(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        5,
      );

      expect(users).toEqual([]);
    });
  });

  describe('getTotalCount', () => {
    it('should return total users in leaderboard', async () => {
      redisClient.zCard.mockResolvedValue(150);

      const count = await service.getTotalCount(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
      );

      expect(count).toBe(150);
    });

    it('should return 0 if empty leaderboard', async () => {
      redisClient.zCard.mockResolvedValue(0);

      const count = await service.getTotalCount(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
      );

      expect(count).toBe(0);
    });

    it('should return 0 on Redis error', async () => {
      redisClient.zCard.mockRejectedValue(new Error('Redis error'));

      const count = await service.getTotalCount(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
      );

      expect(count).toBe(0);
    });
  });

  describe('getAllUsersWithScores', () => {
    it('should return all users with ranks', async () => {
      redisClient.zRevRangeByScoreWithScores.mockResolvedValue([
        { member: 'user-1', score: 5000 },
        { member: 'user-2', score: 4500 },
      ]);

      const users = await service.getAllUsersWithScores(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
      );

      expect(users).toHaveLength(2);
      expect(users[0].rank).toBe(1);
      expect(users[1].rank).toBe(2);
    });

    it('should return empty array on error', async () => {
      redisClient.zRevRangeByScoreWithScores.mockRejectedValue(
        new Error('Redis error'),
      );

      const users = await service.getAllUsersWithScores(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
      );

      expect(users).toEqual([]);
    });

    it('should handle large datasets', async () => {
      const largeSet = Array.from({ length: 1000 }).map((_, i) => ({
        member: `user-${i}`,
        score: 5000 - i,
      }));
      redisClient.zRevRangeByScoreWithScores.mockResolvedValue(largeSet);

      const users = await service.getAllUsersWithScores(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
      );

      expect(users).toHaveLength(1000);
      expect(users[999].rank).toBe(1000);
    });
  });

  describe('clearLeaderboard', () => {
    it('should delete leaderboard key', async () => {
      redisClient.del.mockResolvedValue(1);

      await service.clearLeaderboard(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
      );

      expect(redisClient.del).toHaveBeenCalledWith(
        'leaderboard:TRANSFER_VOLUME:WEEKLY',
      );
    });

    it('should handle Redis errors gracefully', async () => {
      redisClient.del.mockRejectedValue(new Error('Redis error'));

      await expect(
        service.clearLeaderboard(
          LeaderboardType.TRANSFER_VOLUME,
          LeaderboardPeriod.WEEKLY,
        ),
      ).resolves.not.toThrow();
    });

    it('should work for all board types', async () => {
      redisClient.del.mockResolvedValue(1);

      const boardTypes = Object.values(LeaderboardType);
      for (const boardType of boardTypes) {
        await service.clearLeaderboard(boardType, LeaderboardPeriod.WEEKLY);
      }

      expect(redisClient.del).toHaveBeenCalledTimes(boardTypes.length);
    });
  });

  describe('removeUser', () => {
    it('should remove user from leaderboard', async () => {
      redisClient.zRem.mockResolvedValue(1);

      await service.removeUser(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        'user-1',
      );

      expect(redisClient.zRem).toHaveBeenCalledWith(
        'leaderboard:TRANSFER_VOLUME:WEEKLY',
        'user-1',
      );
    });

    it('should handle Redis errors gracefully', async () => {
      redisClient.zRem.mockRejectedValue(new Error('Redis error'));

      await expect(
        service.removeUser(
          LeaderboardType.TRANSFER_VOLUME,
          LeaderboardPeriod.WEEKLY,
          'user-1',
        ),
      ).resolves.not.toThrow();
    });

    it('should handle non-existent user', async () => {
      redisClient.zRem.mockResolvedValue(0);

      await service.removeUser(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        'user-unknown',
      );

      expect(redisClient.zRem).toHaveBeenCalled();
    });
  });

  describe('getCacheKey', () => {
    it('should generate correct cache key', () => {
      const key = service.getCacheKey(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
      );

      expect(key).toBe('cache:leaderboard:TRANSFER_VOLUME:WEEKLY');
    });

    it('should generate unique keys for different types', () => {
      const key1 = service.getCacheKey(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
      );
      const key2 = service.getCacheKey(
        LeaderboardType.REFERRALS,
        LeaderboardPeriod.WEEKLY,
      );

      expect(key1).not.toBe(key2);
    });

    it('should generate unique keys for different periods', () => {
      const key1 = service.getCacheKey(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
      );
      const key2 = service.getCacheKey(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.MONTHLY,
      );

      expect(key1).not.toBe(key2);
    });
  });

  describe('setCachedLeaderboard', () => {
    it('should set cache with default TTL', async () => {
      cacheManager.set.mockResolvedValue(undefined);

      const data = { entries: [] };
      await service.setCachedLeaderboard(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        data,
      );

      expect(cacheManager.set).toHaveBeenCalledWith(
        'cache:leaderboard:TRANSFER_VOLUME:WEEKLY',
        data,
        30000, // 30 seconds
      );
    });

    it('should set cache with custom TTL', async () => {
      cacheManager.set.mockResolvedValue(undefined);

      const data = { entries: [] };
      await service.setCachedLeaderboard(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        data,
        60, // 60 seconds
      );

      expect(cacheManager.set).toHaveBeenCalledWith(
        'cache:leaderboard:TRANSFER_VOLUME:WEEKLY',
        data,
        60000,
      );
    });

    it('should handle cache errors gracefully', async () => {
      cacheManager.set.mockRejectedValue(new Error('Cache error'));

      const data = { entries: [] };
      await expect(
        service.setCachedLeaderboard(
          LeaderboardType.TRANSFER_VOLUME,
          LeaderboardPeriod.WEEKLY,
          data,
        ),
      ).resolves.not.toThrow();
    });

    it('should work with complex data structures', async () => {
      cacheManager.set.mockResolvedValue(undefined);

      const complexData = {
        entries: [{ userId: 'user-1', score: 1000, rank: 1 }],
        total: 100,
        lastUpdated: new Date(),
        nextResetAt: new Date(),
      };

      await service.setCachedLeaderboard(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        complexData,
      );

      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.any(String),
        complexData,
        expect.any(Number),
      );
    });
  });

  describe('getCachedLeaderboard', () => {
    it('should retrieve cached leaderboard', async () => {
      const cachedData = { entries: [] };
      cacheManager.get.mockResolvedValue(cachedData);

      const result = await service.getCachedLeaderboard(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
      );

      expect(result).toEqual(cachedData);
    });

    it('should return null if cache miss', async () => {
      cacheManager.get.mockResolvedValue(null);

      const result = await service.getCachedLeaderboard(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
      );

      expect(result).toBeNull();
    });

    it('should handle cache errors gracefully', async () => {
      cacheManager.get.mockRejectedValue(new Error('Cache error'));

      const result = await service.getCachedLeaderboard(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
      );

      expect(result).toBeNull();
    });
  });

  describe('invalidateCache', () => {
    it('should delete cached leaderboard', async () => {
      cacheManager.del.mockResolvedValue(undefined);

      await service.invalidateCache(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
      );

      expect(cacheManager.del).toHaveBeenCalledWith(
        'cache:leaderboard:TRANSFER_VOLUME:WEEKLY',
      );
    });

    it('should handle cache errors gracefully', async () => {
      cacheManager.del.mockRejectedValue(new Error('Cache error'));

      await expect(
        service.invalidateCache(
          LeaderboardType.TRANSFER_VOLUME,
          LeaderboardPeriod.WEEKLY,
        ),
      ).resolves.not.toThrow();
    });

    it('should work for all board types', async () => {
      cacheManager.del.mockResolvedValue(undefined);

      const boardTypes = Object.values(LeaderboardType);
      for (const boardType of boardTypes) {
        await service.invalidateCache(boardType, LeaderboardPeriod.WEEKLY);
      }

      expect(cacheManager.del).toHaveBeenCalledTimes(boardTypes.length);
    });
  });

  describe('bulkLoadScores', () => {
    it('should load multiple scores to Redis', async () => {
      redisClient.zAdd.mockResolvedValue(undefined);

      const users = [
        { userId: 'user-1', score: 1000 },
        { userId: 'user-2', score: 2000 },
        { userId: 'user-3', score: 3000 },
      ];

      await service.bulkLoadScores(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        users,
      );

      expect(redisClient.zAdd).toHaveBeenCalledWith(
        'leaderboard:TRANSFER_VOLUME:WEEKLY',
        [
          { member: 'user-1', score: 1000 },
          { member: 'user-2', score: 2000 },
          { member: 'user-3', score: 3000 },
        ],
      );
    });

    it('should skip if empty user list', async () => {
      await service.bulkLoadScores(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        [],
      );

      expect(redisClient.zAdd).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      redisClient.zAdd.mockRejectedValue(new Error('Redis error'));

      const users = [{ userId: 'user-1', score: 1000 }];

      await expect(
        service.bulkLoadScores(
          LeaderboardType.TRANSFER_VOLUME,
          LeaderboardPeriod.WEEKLY,
          users,
        ),
      ).resolves.not.toThrow();
    });

    it('should handle large datasets', async () => {
      redisClient.zAdd.mockResolvedValue(undefined);

      const largeDataset = Array.from({ length: 10000 }).map((_, i) => ({
        userId: `user-${i}`,
        score: 10000 - i,
      }));

      await service.bulkLoadScores(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        largeDataset,
      );

      expect(redisClient.zAdd).toHaveBeenCalled();
    });

    it('should handle mixed score values', async () => {
      redisClient.zAdd.mockResolvedValue(undefined);

      const users = [
        { userId: 'user-1', score: 0 },
        { userId: 'user-2', score: 999999 },
        { userId: 'user-3', score: 0.5 },
      ];

      await service.bulkLoadScores(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        users,
      );

      expect(redisClient.zAdd).toHaveBeenCalled();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete workflow: add, check rank, get nearby users', async () => {
      redisClient.zAdd.mockResolvedValue(undefined);
      redisClient.zRevRank.mockResolvedValue(4);
      redisClient.zRevRange.mockResolvedValue(['user-3', '3500', 'user-5', '3300']);

      await service.addScore(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        'user-4',
        3400,
      );

      const rank = await service.getUserRank(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        'user-4',
      );

      const nearby = await service.getNearbyUsers(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        rank!,
      );

      expect(rank).toBe(5);
      expect(nearby.length).toBeGreaterThan(0);
    });

    it('should handle cache workflow: set and get', async () => {
      cacheManager.set.mockResolvedValue(undefined);
      const cachedData = { entries: [], total: 0 };
      cacheManager.get.mockResolvedValue(cachedData);

      await service.setCachedLeaderboard(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        cachedData,
      );

      const retrieved = await service.getCachedLeaderboard(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
      );

      expect(retrieved).toEqual(cachedData);
    });

    it('should handle reset workflow: bulk load, verify, then clear', async () => {
      const users = [
        { userId: 'user-1', score: 1000 },
        { userId: 'user-2', score: 2000 },
      ];

      redisClient.zAdd.mockResolvedValue(undefined);
      redisClient.zCard.mockResolvedValue(2);
      redisClient.del.mockResolvedValue(1);

      await service.bulkLoadScores(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        users,
      );

      const count = await service.getTotalCount(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
      );
      expect(count).toBe(2);

      await service.clearLeaderboard(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
      );

      expect(redisClient.del).toHaveBeenCalled();
    });
  });
});
