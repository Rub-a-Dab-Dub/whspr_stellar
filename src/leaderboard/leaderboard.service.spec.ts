import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardEntriesRepository, LeaderboardSnapshotsRepository } from './leaderboard.repository';
import { LeaderboardEntry, LeaderboardPeriod, LeaderboardType, LeaderboardSnapshot } from './entities/leaderboard-entry.entity';
import { User } from '../users/entities/user.entity';

describe('LeaderboardService', () => {
  let service: LeaderboardService;
  let leaderboardRepo: jest.Mocked<LeaderboardEntriesRepository>;
  let snapshotsRepo: jest.Mocked<LeaderboardSnapshotsRepository>;
  let usersRepo: jest.Mocked<Repository<User>>;

  const mockUser: User = {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    avatarUrl: 'https://example.com/avatar.jpg',
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
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LeaderboardService>(LeaderboardService);
    leaderboardRepo = module.get(getRepositoryToken(LeaderboardEntry)) as jest.Mocked<LeaderboardEntriesRepository>;
    snapshotsRepo = module.get(getRepositoryToken(LeaderboardSnapshot)) as jest.Mocked<LeaderboardSnapshotsRepository>;
    usersRepo = module.get(getRepositoryToken(User)) as jest.Mocked<Repository<User>>;
  });

  describe('updateUserScore', () => {
    it('should create new entry if not exists', async () => {
      usersRepo.findOne.mockResolvedValue(mockUser);
      leaderboardRepo.findByUserAndBoard.mockResolvedValue(null);
      leaderboardRepo.save.mockResolvedValue(mockLeaderboardEntry);

      await service.updateUserScore(LeaderboardType.TRANSFER_VOLUME, 'user-1', 100, true);

      expect(leaderboardRepo.save).toHaveBeenCalled();
      expect(leaderboardRepo.findByUserAndBoard).toHaveBeenCalledWith(
        'user-1',
        LeaderboardType.TRANSFER_VOLUME,
        expect.any(Object),
      );
    });

    it('should update existing entry with delta score', async () => {
      const existingEntry = { ...mockLeaderboardEntry, score: 500 };
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
