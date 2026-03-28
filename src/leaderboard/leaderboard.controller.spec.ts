import { Test, TestingModule } from '@nestjs/testing';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardPeriod, LeaderboardType } from './entities/leaderboard-entry.entity';
import { User } from '../users/entities/user.entity';

describe('LeaderboardController', () => {
  let controller: LeaderboardController;
  let service: jest.Mocked<LeaderboardService>;

  const mockUser: User = {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    avatarUrl: 'https://example.com/avatar.jpg',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeaderboardController],
      providers: [
        {
          provide: LeaderboardService,
          useValue: {
            getLeaderboard: jest.fn(),
            getUserRank: jest.fn(),
            getLeaderboardStats: jest.fn(),
            getUserHistory: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<LeaderboardController>(LeaderboardController);
    service = module.get(LeaderboardService) as jest.Mocked<LeaderboardService>;
  });

  describe('getLeaderboard', () => {
    it('should return leaderboard with default parameters', async () => {
      const mockResponse = {
        entries: [],
        total: 0,
        lastUpdated: new Date(),
        nextResetAt: new Date(),
      };

      service.getLeaderboard.mockResolvedValue(mockResponse);

      const result = await controller.getLeaderboard(LeaderboardType.TRANSFER_VOLUME);

      expect(result).toEqual(mockResponse);
      expect(service.getLeaderboard).toHaveBeenCalledWith(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        100,
      );
    });

    it('should return leaderboard with custom parameters', async () => {
      const mockResponse = {
        entries: [],
        total: 5,
        lastUpdated: new Date(),
        nextResetAt: new Date(),
      };

      service.getLeaderboard.mockResolvedValue(mockResponse);

      const result = await controller.getLeaderboard(
        LeaderboardType.REFERRALS,
        LeaderboardPeriod.MONTHLY,
        50,
      );

      expect(result).toEqual(mockResponse);
      expect(service.getLeaderboard).toHaveBeenCalledWith(
        LeaderboardType.REFERRALS,
        LeaderboardPeriod.MONTHLY,
        50,
      );
    });
  });

  describe('getUserRank', () => {
    it('should return user rank', async () => {
      const mockResponse = {
        rank: 1,
        percentile: 99,
        score: 5000,
        user: {
          id: 'user-1',
          username: 'testuser',
          avatarUrl: 'https://example.com/avatar.jpg',
        },
        nearbyUsers: [],
      };

      service.getUserRank.mockResolvedValue(mockResponse);

      const result = await controller.getUserRank(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
        mockUser,
      );

      expect(result).toEqual(mockResponse);
      expect(service.getUserRank).toHaveBeenCalledWith(
        'user-1',
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
      );
    });

    it('should return null for user not in leaderboard', async () => {
      service.getUserRank.mockResolvedValue(null);

      const result = await controller.getUserRank(
        LeaderboardType.REPUTATION,
        LeaderboardPeriod.MONTHLY,
        mockUser,
      );

      expect(result).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return leaderboard statistics', async () => {
      const mockResponse = {
        totalParticipants: 100,
        topScore: 50000,
        topUser: {
          id: 'top-user',
          username: 'topuser',
          avatarUrl: 'https://example.com/top.jpg',
        },
        avgScore: 2500,
        medianScore: 2450,
      };

      service.getLeaderboardStats.mockResolvedValue(mockResponse);

      const result = await controller.getStats(LeaderboardType.TRANSFER_VOLUME, LeaderboardPeriod.WEEKLY);

      expect(result).toEqual(mockResponse);
      expect(service.getLeaderboardStats).toHaveBeenCalledWith(
        LeaderboardType.TRANSFER_VOLUME,
        LeaderboardPeriod.WEEKLY,
      );
    });
  });

  describe('getHistory', () => {
    it('should return user history', async () => {
      const mockResponse = [
        {
          period: LeaderboardPeriod.WEEKLY,
          rank: 5,
          score: 3000,
          rankChange: -2,
          snapshotDate: new Date(),
        },
      ];

      service.getUserHistory.mockResolvedValue(mockResponse);

      const result = await controller.getHistory(
        LeaderboardType.TRANSFER_VOLUME,
        10,
        mockUser,
      );

      expect(result).toEqual(mockResponse);
      expect(service.getUserHistory).toHaveBeenCalledWith('user-1', LeaderboardType.TRANSFER_VOLUME, 10);
    });

    it('should return empty history', async () => {
      service.getUserHistory.mockResolvedValue([]);

      const result = await controller.getHistory(LeaderboardType.TRANSFER_VOLUME, 10, mockUser);

      expect(result).toEqual([]);
    });
  });
});
