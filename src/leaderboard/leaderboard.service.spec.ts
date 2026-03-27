import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardEntriesRepository, LeaderboardSnapshotsRepository } from './leaderboard.repository';
import { LeaderboardEntry, LeaderboardPeriod, LeaderboardType, LeaderboardSnapshot } from './entities/leaderboard-entry.entity';
import { RedisLeaderboardService } from './redis-leaderboard.service';
import { User } from '../users/entities/user.entity';

describe('LeaderboardService', () => {
  let service: LeaderboardService;
  let leaderboardRepo: jest.Mocked<LeaderboardEntriesRepository>;
  let snapshotsRepo: jest.Mocked<LeaderboardSnapshotsRepository>;
  let usersRepo: jest.Mocked<Repository<User>>;
  let redisService: jest.Mocked<RedisLeaderboardService>;

  const mockUser: User = {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    avatarUrl: 'https://example.com/avatar.jpg',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  const mockUser2: User = {
    id: 'user-2',
    username: 'testuser2',
    email: 'test2@example.com',
    avatarUrl: 'https://example.com/avatar2.jpg',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  const mockLeaderboardEntry: LeaderboardEntry = {
    id: '1',
    userId: 'user-1',
    boardType: LeaderboardType.TRANSFER_VOLUME,
    period: LeaderboardPeriod.WEEKLY,
    score: 1000,
    rank: 1,
    changeFromLastPeriod: 5,
    computedAt: new Date(),
    metadata: {},
    user: mockUser,
    periodStartAt: new Date(),
    periodEndAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderboardService,
        {
          provide: getRepositoryToken(LeaderboardEntry),
          useValue: {
            findByUserAndBoard: jest.fn(),
            findLeaderboard: jest.fn(),
            findUserRank: jest.fn(),
            findNearbyUsers: jest.fn(),
            countParticipants: jest.fn(),
            getStatistics: jest.fn(),
            getTopEntry: jest.fn(),
            resetPeriodEntries: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(LeaderboardSnapshot),
          useValue: {
            getUserHistory: jest.fn(),
            saveSnapshot: jest.fn(),
            getPeriodSnapshot: jest.fn(),
            insert: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: RedisLeaderboardService,
          useValue: {
            addScore: jest.fn(),
            incrementScore: jest.fn(),
            getUserRank: jest.fn(),
            getUserScore: jest.fn(),
            getTopUsers: jest.fn(),
            getNearbyUsers: jest.fn(),
            getTotalCount: jest.fn(),
            getAllUsersWithScores: jest.fn(),
            clearLeaderboard: jest.fn(),
            removeUser: jest.fn(),
            getCacheKey: jest.fn(),
            setCachedLeaderboard: jest.fn(),
            getCachedLeaderboard: jest.fn(),
            invalidateCache: jest.fn(),
            bulkLoadScores: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LeaderboardService>(LeaderboardService);
    leaderboardRepo = module.get(getRepositoryToken(LeaderboardEntry)) as jest.Mocked<LeaderboardEntriesRepository>;
    snapshotsRepo = module.get(getRepositoryToken(LeaderboardSnapshot)) as jest.Mocked<LeaderboardSnapshotsRepository>;
    usersRepo = module.get(getRepositoryToken(User)) as jest.Mocked<Repository<User>>;
    redisService = module.get(RedisLeaderboardService) as jest.Mocked<RedisLeaderboardService>;
  });

  describe('updateUserScore', () => {
    it('should create new entry if not exists', async () => {
      usersRepo.findOne.mockResolvedValue(mockUser);
      leaderboardRepo.findByUserAndBoard.mockResolvedValue(null);
      const savedEntry = { ...mockLeaderboardEntry };
      leaderboardRepo.save.mockResolvedValue(savedEntry);
      redisService.addScore.mockResolvedValue(undefined);
      redisService.invalidateCache.mockResolvedValue(undefined);

      await service.updateUserScore(
        LeaderboardType.TRANSFER_VOLUME,
        'user-1',
        100,
        true,
      );

      expect(leaderboardRepo.save).toHaveBeenCalled();
      expect(redisService.addScore).toHaveBeenCalled();
      expect(redisService.invalidateCache).toHaveBeenCalled();
    });

    it('should update existing entry with delta score', async () => {
      const existingEntry = { ...mockLeaderboardEntry, score: 500 };
      usersRepo.findOne.mockResolvedValue(mockUser);
      leaderboardRepo.findByUserAndBoard.mockResolvedValue(existingEntry);
      const updatedEntry = { ...existingEntry, score: 600 };
      leaderboardRepo.save.mockResolvedValue(updatedEntry);
      redisService.addScore.mockResolvedValue(undefined);
      redisService.invalidateCache.mockResolvedValue(undefined);

      await service.updateUserScore(
        LeaderboardType.TRANSFER_VOLUME,
        'user-1',
        100,
        true,
      );

      expect(leaderboardRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ score: 600 }),
      );
      expect(redisService.addScore).toHaveBeenCalled();
    });

    it('should set absolute score when isDelta is false', async () => {
      usersRepo.findOne.mockResolvedValue(mockUser);
      leaderboardRepo.findByUserAndBoard.mockResolvedValue(mockLeaderboardEntry);
      const updatedEntry = { ...mockLeaderboardEntry, score: 500 };
      leaderboardRepo.save.mockResolvedValue(updatedEntry);
      redisService.addScore.mockResolvedValue(undefined);
      redisService.invalidateCache.mockResolvedValue(undefined);

      await service.updateUserScore(
        LeaderboardType.TRANSFER_VOLUME,
        'user-1',
        500,
        false,
      );

      expect(leaderboardRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ score: 500 }),
      );
    });

    it('should handle metadata', async () => {
      usersRepo.findOne.mockResolvedValue(mockUser);
      leaderboardRepo.findByUserAndBoard.mockResolvedValue(null);
      const metadata = { transferId: 'tx-123' };
      leaderboardRepo.save.mockResolvedValue(mockLeaderboardEntry);
      redisService.addScore.mockResolvedValue(undefined);
      redisService.invalidateCache.mockResolvedValue(undefined);

      await service.updateUserScore(
        LeaderboardType.TRANSFER_VOLUME,
        'user-1',
        100,
        true,
        metadata,
      );

      expect(leaderboardRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ metadata }),
      );
    });

    it('should not update if user not found', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await service.updateUserScore(
        LeaderboardType.TRANSFER_VOLUME,
        'user-invalid',
        100,
      );

      expect(leaderboardRepo.save).not.toHaveBeenCalled();
    });

    it('should prevent score from going negative', async () => {
      const entry = { ...mockLeaderboardEntry, score: 50 };
      usersRepo.findOne.mockResolvedValue(mockUser);
      leaderboardRepo.findByUserAndBoard.mockResolvedValue(entry);
      leaderboardRepo.save.mockResolvedValue(entry);
      redisService.addScore.mockResolvedValue(undefined);
      redisService.invalidateCache.mockResolvedValue(undefined);

      await service.updateUserScore(
        LeaderboardType.TRANSFER_VOLUME,
        'user-1',
        -100,
        true,
      );

      expect(leaderboardRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ score: 0 }),
      );
    });
  });

  describe('getLeaderboard', () => {
    it('should return cached leaderboard if available', async () => {
      const cachedData = {
        entries: [],
        total: 10,
        lastUpdated: new Date(),
        nextResetAt: new Date(),
      };
      redisService.getCachedLeaderboard.mockResolvedValue(cachedData);

      const result = await service.getLeaderboard(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        100,
      );

      expect(result).toEqual(cachedData);
      expect(redisService.getCachedLeaderboard).toHaveBeenCalled();
    });

    it('should fetch from Redis and cache if not available', async () => {
      redisService.getCachedLeaderboard.mockResolvedValue(null);
      redisService.getTopUsers.mockResolvedValue([
        { userId: 'user-1', score: 1000, rank: 1 },
        { userId: 'user-2', score: 900, rank: 2 },
      ]);
      usersRepo.find.mockResolvedValue([mockUser, mockUser2]);
      redisService.getTotalCount.mockResolvedValue(2);
      redisService.setCachedLeaderboard.mockResolvedValue(undefined);

      const result = await service.getLeaderboard(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        100,
      );

      expect(result.entries).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(redisService.setCachedLeaderboard).toHaveBeenCalled();
    });

    it('should cap limit to 500', async () => {
      redisService.getCachedLeaderboard.mockResolvedValue(null);
      redisService.getTopUsers.mockResolvedValue([]);
      usersRepo.find.mockResolvedValue([]);
      redisService.getTotalCount.mockResolvedValue(0);
      redisService.setCachedLeaderboard.mockResolvedValue(undefined);

      await service.getLeaderboard(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        1000,
      );

      expect(redisService.getTopUsers).toHaveBeenCalledWith(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        500,
      );
    });

    it('should not cache if requesting more than top-100', async () => {
      redisService.getCachedLeaderboard.mockResolvedValue(null);
      redisService.getTopUsers.mockResolvedValue([]);
      usersRepo.find.mockResolvedValue([]);
      redisService.getTotalCount.mockResolvedValue(0);
      redisService.setCachedLeaderboard.mockResolvedValue(undefined);

      await service.getLeaderboard(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        150,
      );

      expect(redisService.setCachedLeaderboard).not.toHaveBeenCalled();
    });
  });

  describe('getUserRank', () => {
    it('should return user rank with nearby users', async () => {
      usersRepo.findOne.mockResolvedValue(mockUser);
      redisService.getUserRank.mockResolvedValue(1);
      redisService.getUserScore.mockResolvedValue(1000);
      redisService.getTotalCount.mockResolvedValue(100);
      redisService.getNearbyUsers.mockResolvedValue([
        { userId: 'user-1', score: 1000, rank: 1 },
        { userId: 'user-2', score: 950, rank: 2 },
      ]);
      usersRepo.find.mockResolvedValue([mockUser, mockUser2]);

      const result = await service.getUserRank(
        'user-1',
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
      );

      expect(result.rank).toBe(1);
      expect(result.score).toBe(1000);
      expect(result.percentile).toBe(100);
      expect(result.nearbyUsers.length).toBeGreaterThanOrEqual(0);
    });

    it('should return null if user not found', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      const result = await service.getUserRank(
        'user-invalid',
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
      );

      expect(result).toBeNull();
    });

    it('should handle unranked user', async () => {
      usersRepo.findOne.mockResolvedValue(mockUser);
      redisService.getUserRank.mockResolvedValue(null);
      redisService.getUserScore.mockResolvedValue(0);
      redisService.getTotalCount.mockResolvedValue(100);
      redisService.getNearbyUsers.mockResolvedValue([]);
      usersRepo.find.mockResolvedValue([]);

      const result = await service.getUserRank(
        'user-1',
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
      );

      expect(result.rank).toBeNull();
      expect(result.percentile).toBe(0);
      expect(result.score).toBe(0);
    });
  });

  describe('getLeaderboardStats', () => {
    it('should return leaderboard statistics', async () => {
      const stats = { avgScore: '500', medianScore: '450', count: '100' };
      leaderboardRepo.getStatistics.mockResolvedValue(stats);
      redisService.getTotalCount.mockResolvedValue(100);
      redisService.getTopUsers.mockResolvedValue([
        { userId: 'user-1', score: 1000, rank: 1 },
      ]);
      usersRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.getLeaderboardStats(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
      );

      expect(result.totalParticipants).toBe(100);
      expect(result.topScore).toBe(1000);
      expect(result.topUser).not.toBeNull();
      expect(result.avgScore).toBe(500);
    });

    it('should handle no top user', async () => {
      const stats = { avgScore: '0', medianScore: '0', count: '0' };
      leaderboardRepo.getStatistics.mockResolvedValue(stats);
      redisService.getTotalCount.mockResolvedValue(0);
      redisService.getTopUsers.mockResolvedValue([]);

      const result = await service.getLeaderboardStats(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
      );

      expect(result.topUser).toBeNull();
      expect(result.totalParticipants).toBe(0);
    });
  });

  describe('getUserHistory', () => {
    it('should return user history snapshots', async () => {
      const snapshots = [
        {
          period: LeaderboardPeriod.WEEKLY,
          rank: 1,
          score: 1000,
          rankChangeFromPrevious: 5,
          snapshotDate: new Date(),
        } as LeaderboardSnapshot,
      ];
      snapshotsRepo.getUserHistory.mockResolvedValue(snapshots);

      const result = await service.getUserHistory(
        'user-1',
        LeaderboardType.TRANSFER_VOLUME,
        10,
      );

      expect(result).toHaveLength(1);
      expect(result[0].rank).toBe(1);
      expect(result[0].score).toBe(1000);
    });

    it('should limit history results', async () => {
      snapshotsRepo.getUserHistory.mockResolvedValue([]);

      await service.getUserHistory(
        'user-1',
        LeaderboardType.TRANSFER_VOLUME,
        5,
      );

      expect(snapshotsRepo.getUserHistory).toHaveBeenCalledWith(
        'user-1',
        LeaderboardType.TRANSFER_VOLUME,
        5,
      );
    });
  });

  describe('computeLeaderboard', () => {
    it('should compute leaderboard and update Redis', async () => {
      const entries = [
        { ...mockLeaderboardEntry, score: 1000 },
        { ...mockLeaderboardEntry, userId: 'user-2', score: 900 },
      ];
      leaderboardRepo.find.mockResolvedValue(entries);
      redisService.clearLeaderboard.mockResolvedValue(undefined);
      redisService.bulkLoadScores.mockResolvedValue(undefined);
      redisService.getAllUsersWithScores.mockResolvedValue([
        { userId: 'user-1', score: 1000, rank: 1 },
        { userId: 'user-2', score: 900, rank: 2 },
      ]);
      leaderboardRepo.save.mockResolvedValue(entries[0]);
      redisService.invalidateCache.mockResolvedValue(undefined);

      await service.computeLeaderboard(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
      );

      expect(redisService.clearLeaderboard).toHaveBeenCalled();
      expect(redisService.bulkLoadScores).toHaveBeenCalled();
      expect(leaderboardRepo.save).toHaveBeenCalled();
      expect(redisService.invalidateCache).toHaveBeenCalled();
    });

    it('should handle empty leaderboard', async () => {
      leaderboardRepo.find.mockResolvedValue([]);

      await service.computeLeaderboard(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
      );

      expect(redisService.clearLeaderboard).not.toHaveBeenCalled();
    });
  });

  describe('resetWeeklyLeaderboards', () => {
    it('should archive and reset all weekly leaderboards', async () => {
      leaderboardRepo.find.mockResolvedValue([mockLeaderboardEntry]);
      snapshotsRepo.saveSnapshot.mockResolvedValue(undefined);
      leaderboardRepo.resetPeriodEntries.mockResolvedValue(undefined);
      redisService.clearLeaderboard.mockResolvedValue(undefined);
      redisService.invalidateCache.mockResolvedValue(undefined);

      await service.resetWeeklyLeaderboards();

      expect(leaderboardRepo.find).toHaveBeenCalled();
      expect(snapshotsRepo.saveSnapshot).toHaveBeenCalled();
      expect(leaderboardRepo.resetPeriodEntries).toHaveBeenCalled();
    });
  });

  describe('resetMonthlyLeaderboards', () => {
    it('should archive and reset all monthly leaderboards', async () => {
      leaderboardRepo.find.mockResolvedValue([mockLeaderboardEntry]);
      snapshotsRepo.saveSnapshot.mockResolvedValue(undefined);
      leaderboardRepo.resetPeriodEntries.mockResolvedValue(undefined);
      redisService.clearLeaderboard.mockResolvedValue(undefined);
      redisService.invalidateCache.mockResolvedValue(undefined);

      await service.resetMonthlyLeaderboards();

      expect(leaderboardRepo.find).toHaveBeenCalled();
      expect(snapshotsRepo.saveSnapshot).toHaveBeenCalled();
    });
  });

  describe('Board Type Coverage', () => {
    it('should handle all board types', async () => {
      usersRepo.findOne.mockResolvedValue(mockUser);
      leaderboardRepo.findByUserAndBoard.mockResolvedValue(null);
      leaderboardRepo.save.mockResolvedValue(mockLeaderboardEntry);
      redisService.addScore.mockResolvedValue(undefined);
      redisService.invalidateCache.mockResolvedValue(undefined);

      const boardTypes = Object.values(LeaderboardType);
      for (const boardType of boardTypes) {
        await service.updateUserScore(boardType, 'user-1', 100);
        expect(redisService.addScore).toHaveBeenCalledWith(
          boardType,
          expect.any(String),
          'user-1',
          expect.any(Number),
        );
      }
    });
  });

  describe('Period Coverage', () => {
    it('should handle all periods', async () => {
      redisService.getCachedLeaderboard.mockResolvedValue(null);
      redisService.getTopUsers.mockResolvedValue([]);
      usersRepo.find.mockResolvedValue([]);
      redisService.getTotalCount.mockResolvedValue(0);

      const periods = Object.values(LeaderboardPeriod);
      for (const period of periods) {
        await service.getLeaderboard(
          LeaderboardType.TRANSFER_VOLUME,
          period,
        );
      }

      expect(redisService.getCachedLeaderboard).toHaveBeenCalledTimes(
        periods.length,
      );
    });
  });
});
      usersRepo.findOne.mockResolvedValue(mockUser);
      leaderboardRepo.findByUserAndBoard.mockResolvedValue(existingEntry);
      leaderboardRepo.save.mockResolvedValue({ ...existingEntry, score: 600 });

      await service.updateUserScore(LeaderboardType.TRANSFER_VOLUME, 'user-1', 100, true);

      expect(leaderboardRepo.save).toHaveBeenCalledWith(expect.objectContaining({ score: 600 }));
    });

    it('should update existing entry with absolute score', async () => {
      usersRepo.findOne.mockResolvedValue(mockUser);
      leaderboardRepo.findByUserAndBoard.mockResolvedValue(mockLeaderboardEntry);
      leaderboardRepo.save.mockResolvedValue({ ...mockLeaderboardEntry, score: 250 });

      await service.updateUserScore(LeaderboardType.TRANSFER_VOLUME, 'user-1', 250, false);

      expect(leaderboardRepo.save).toHaveBeenCalledWith(expect.objectContaining({ score: 250 }));
    });

    it('should not update if user does not exist', async () => {
      usersRepo.findOne.mockResolvedValue(null);

      await service.updateUserScore(LeaderboardType.TRANSFER_VOLUME, 'unknown-user', 100);

      expect(leaderboardRepo.save).not.toHaveBeenCalled();
    });

    it('should prevent negative scores', async () => {
      const existingEntry = { ...mockLeaderboardEntry, score: 50 };
      usersRepo.findOne.mockResolvedValue(mockUser);
      leaderboardRepo.findByUserAndBoard.mockResolvedValue(existingEntry);
      leaderboardRepo.save.mockResolvedValue({ ...existingEntry, score: 0 });

      await service.updateUserScore(LeaderboardType.TRANSFER_VOLUME, 'user-1', -100, true);

      expect(leaderboardRepo.save).toHaveBeenCalledWith(expect.objectContaining({ score: 0 }));
    });
  });

  describe('getLeaderboard', () => {
    it('should return leaderboard with entries', async () => {
      const mockEntries = [mockLeaderboardEntry];
      leaderboardRepo.findLeaderboard.mockResolvedValue(mockEntries);
      leaderboardRepo.countParticipants.mockResolvedValue(1);

      const result = await service.getLeaderboard(LeaderboardType.TRANSFER_VOLUME, LeaderboardPeriod.WEEKLY, 100);

      expect(result).toHaveProperty('entries');
      expect(result).toHaveProperty('total', 1);
      expect(result).toHaveProperty('lastUpdated');
      expect(result).toHaveProperty('nextResetAt');
      expect(result.entries.length).toBe(1);
    });

    it('should cap limit at 500', async () => {
      leaderboardRepo.findLeaderboard.mockResolvedValue([]);
      leaderboardRepo.countParticipants.mockResolvedValue(0);

      await service.getLeaderboard(LeaderboardType.TRANSFER_VOLUME, LeaderboardPeriod.WEEKLY, 1000);

      expect(leaderboardRepo.findLeaderboard).toHaveBeenCalledWith(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        500,
      );
    });

    it('should return empty leaderboard', async () => {
      leaderboardRepo.findLeaderboard.mockResolvedValue([]);
      leaderboardRepo.countParticipants.mockResolvedValue(0);

      const result = await service.getLeaderboard(LeaderboardType.TRANSFER_VOLUME, LeaderboardPeriod.WEEKLY);

      expect(result.entries).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getUserRank', () => {
    it('should return user rank with nearby users', async () => {
      const user2 = { ...mockUser, id: 'user-2', username: 'user2' };
      const nearbyEntry = { ...mockLeaderboardEntry, user: user2, rank: 2 };

      leaderboardRepo.findUserRank.mockResolvedValue(mockLeaderboardEntry);
      leaderboardRepo.countParticipants.mockResolvedValue(100);
      leaderboardRepo.findNearbyUsers.mockResolvedValue([mockLeaderboardEntry, nearbyEntry]);

      const result = await service.getUserRank('user-1', LeaderboardType.TRANSFER_VOLUME, LeaderboardPeriod.WEEKLY);

      expect(result).toHaveProperty('rank', 1);
      expect(result).toHaveProperty('percentile');
      expect(result).toHaveProperty('score', 1000);
      expect(result).toHaveProperty('nearbyUsers');
    });

    it('should return null for non-existent user', async () => {
      leaderboardRepo.findUserRank.mockResolvedValue(null);
      usersRepo.findOne.mockResolvedValue(null);

      const result = await service.getUserRank('unknown-user', LeaderboardType.TRANSFER_VOLUME, LeaderboardPeriod.WEEKLY);

      expect(result).toBeNull();
    });

    it('should return default rank for user not in leaderboard', async () => {
      leaderboardRepo.findUserRank.mockResolvedValue(null);
      usersRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.getUserRank('user-1', LeaderboardType.TRANSFER_VOLUME, LeaderboardPeriod.WEEKLY);

      expect(result).toHaveProperty('rank', null);
      expect(result).toHaveProperty('percentile', 0);
      expect(result).toHaveProperty('score', 0);
    });

    it('should calculate percentile correctly', async () => {
      const entry = { ...mockLeaderboardEntry, rank: 25 };
      leaderboardRepo.findUserRank.mockResolvedValue(entry);
      leaderboardRepo.countParticipants.mockResolvedValue(100);
      leaderboardRepo.findNearbyUsers.mockResolvedValue([entry]);

      const result = await service.getUserRank('user-1', LeaderboardType.TRANSFER_VOLUME, LeaderboardPeriod.WEEKLY);

      const expectedPercentile = Math.round(((100 - 25 + 1) / 100) * 100);
      expect(result.percentile).toBe(expectedPercentile);
    });
  });

  describe('getLeaderboardStats', () => {
    it('should return leaderboard statistics', async () => {
      leaderboardRepo.getStatistics.mockResolvedValue({
        count: '100',
        maxScore: '5000',
        avgScore: '2500',
        medianScore: '2450',
      });
      leaderboardRepo.getTopEntry.mockResolvedValue(mockLeaderboardEntry);

      const result = await service.getLeaderboardStats(LeaderboardType.TRANSFER_VOLUME, LeaderboardPeriod.WEEKLY);

      expect(result).toHaveProperty('totalParticipants', 100);
      expect(result).toHaveProperty('topScore', 5000);
      expect(result).toHaveProperty('avgScore', 2500);
      expect(result).toHaveProperty('medianScore', 2450);
      expect(result).toHaveProperty('topUser');
    });

    it('should handle empty statistics', async () => {
      leaderboardRepo.getStatistics.mockResolvedValue({
        count: '0',
        maxScore: null,
        avgScore: null,
        medianScore: null,
      });
      leaderboardRepo.getTopEntry.mockResolvedValue(null);

      const result = await service.getLeaderboardStats(LeaderboardType.TRANSFER_VOLUME, LeaderboardPeriod.WEEKLY);

      expect(result.totalParticipants).toBe(0);
      expect(result.topScore).toBe(0);
      expect(result.topUser).toBeNull();
    });
  });

  describe('getUserHistory', () => {
    it('should return user history', async () => {
      const mockSnapshot = {
        period: LeaderboardPeriod.WEEKLY,
        rank: 5,
        score: 800,
        rankChangeFromPrevious: 10,
        snapshotDate: new Date(),
      };

      snapshotsRepo.getUserHistory.mockResolvedValue([mockSnapshot] as any);

      const result = await service.getUserHistory('user-1', LeaderboardType.TRANSFER_VOLUME);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('rank', 5);
      expect(result[0]).toHaveProperty('score', 800);
    });

    it('should return empty history', async () => {
      snapshotsRepo.getUserHistory.mockResolvedValue([]);

      const result = await service.getUserHistory('user-1', LeaderboardType.TRANSFER_VOLUME);

      expect(result).toEqual([]);
    });
  });

  describe('resetWeeklyLeaderboards', () => {
    it('should archive and reset weekly leaderboards', async () => {
      const entries = [mockLeaderboardEntry];
      leaderboardRepo.find.mockResolvedValue(entries);
      snapshotsRepo.saveSnapshot.mockResolvedValue();
      leaderboardRepo.resetPeriodEntries.mockResolvedValue();

      await service.resetWeeklyLeaderboards();

      expect(snapshotsRepo.saveSnapshot).toHaveBeenCalled();
      expect(leaderboardRepo.resetPeriodEntries).toHaveBeenCalled();
    });
  });

  describe('resetMonthlyLeaderboards', () => {
    it('should archive and reset monthly leaderboards', async () => {
      const entries = [mockLeaderboardEntry];
      leaderboardRepo.find.mockResolvedValue(entries);
      snapshotsRepo.saveSnapshot.mockResolvedValue();
      leaderboardRepo.resetPeriodEntries.mockResolvedValue();

      await service.resetMonthlyLeaderboards();

      expect(snapshotsRepo.saveSnapshot).toHaveBeenCalled();
      expect(leaderboardRepo.resetPeriodEntries).toHaveBeenCalled();
    });
  });
});
