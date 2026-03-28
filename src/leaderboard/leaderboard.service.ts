import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { LeaderboardEntry, LeaderboardPeriod, LeaderboardType, LeaderboardSnapshot } from './entities/leaderboard-entry.entity';
import { LeaderboardEntriesRepository, LeaderboardSnapshotsRepository } from './leaderboard.repository';
import { RedisLeaderboardService } from './redis-leaderboard.service';
import {
  UpdateLeaderboardScoreDto,
  LeaderboardEntryResponseDto,
  GetLeaderboardDto,
  LeaderboardResponseDto,
  UserRankResponseDto,
  LeaderboardStatsResponseDto,
  LeaderboardHistoryResponseDto,
} from './dto/leaderboard.dto';

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);
  private readonly CACHE_TTL_SECONDS = 30;
  private readonly TOP_LIMIT = 100;

  constructor(
    @InjectRepository(LeaderboardEntry)
    private leaderboardRepo: LeaderboardEntriesRepository,
    @InjectRepository(LeaderboardSnapshot)
    private snapshotsRepo: LeaderboardSnapshotsRepository,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private redisService: RedisLeaderboardService,
  ) {}

  async updateUserScore(
    boardType: LeaderboardType,
    userId: string,
    scoreValue: number,
    isDelta: boolean = true,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      const user = await this.usersRepo.findOne({ where: { id: userId } });
      if (!user) {
        this.logger.warn(`User ${userId} not found for leaderboard update`);
        return;
      }

      const currentPeriod = this.getCurrentPeriod();
      let entry = await this.leaderboardRepo.findByUserAndBoard(userId, boardType, currentPeriod);

      if (!entry) {
        entry = new LeaderboardEntry();
        entry.userId = userId;
        entry.boardType = boardType;
        entry.period = currentPeriod;
        entry.score = isDelta ? scoreValue : scoreValue;
        entry.changeFromLastPeriod = 0;
        entry.periodStartAt = this.getPeriodStartDate(currentPeriod);
        entry.periodEndAt = this.getNextResetDate(currentPeriod);
      } else {
        if (isDelta) {
          entry.score = Math.max(0, entry.score + scoreValue);
        } else {
          entry.score = Math.max(0, scoreValue);
        }
      }

      entry.computedAt = new Date();
      if (metadata) {
        entry.metadata = metadata;
      }

      // Save to database
      await this.leaderboardRepo.save(entry);

      // Update Redis sorted set for real-time ranking
      await this.redisService.addScore(boardType, currentPeriod, userId, entry.score);

      // Invalidate cache so next fetch gets fresh data
      await this.redisService.invalidateCache(boardType, currentPeriod);

      this.logger.debug(
        `Updated score for user ${userId} on board ${boardType}: ${entry.score}`,
      );
    } catch (error) {
      this.logger.error(
        `Error updating user score: ${(error as Error).message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getLeaderboard(
    boardType: LeaderboardType,
    period: LeaderboardPeriod,
    limit: number = 100,
  ): Promise<LeaderboardResponseDto> {
    try {
      const limit_capped = Math.min(limit, 500);

      // Try to get from cache first (for top-100)
      let entries = [];
      let fromCache = false;

      if (limit_capped <= this.TOP_LIMIT) {
        const cached = await this.redisService.getCachedLeaderboard(boardType, period);
        if (cached) {
          return cached as LeaderboardResponseDto;
        }
      }

      // If not cached or requesting more than top-100, fetch from Redis sorted set
      const redisEntries = await this.redisService.getTopUsers(
        boardType,
        period,
        limit_capped,
      );

      // Fetch full user details from database
      const userIds = redisEntries.map(e => e.userId);
      const users = await this.usersRepo.find({
        where: { id: { inQuery: this.buildInQuery(userIds) } as any },
      });
      const userMap = new Map(users.map(u => [u.id, u]));

      entries = redisEntries.map(redisEntry => ({
        rank: redisEntry.rank,
        score: redisEntry.score,
        user: userMap.get(redisEntry.userId),
        userId: redisEntry.userId,
        boardType,
        period,
      }));

      // Cache if requesting top-100
      if (limit_capped <= this.TOP_LIMIT && entries.length > 0) {
        const cacheData = {
          entries: entries.map(e => ({
            id: '',
            boardType,
            userId: e.userId,
            username: e.user?.username || '',
            avatarUrl: e.user?.avatarUrl || '',
            score: e.score,
            rank: e.rank,
            period,
            computedAt: new Date(),
            changeFromLastPeriod: 0,
          })),
          total: await this.redisService.getTotalCount(boardType, period),
          lastUpdated: new Date(),
          nextResetAt: this.getNextResetDate(period),
        };
        await this.redisService.setCachedLeaderboard(
          boardType,
          period,
          cacheData,
          this.CACHE_TTL_SECONDS,
        );
      }

      const total = await this.redisService.getTotalCount(boardType, period);
      const nextResetAt = this.getNextResetDate(period);

      const entryDtos = entries.map(entry =>
        this.mapEntryToDto(entry),
      );

      return {
        entries: entryDtos,
        total,
        lastUpdated: new Date(),
        nextResetAt,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching leaderboard: ${(error as Error).message}`,
        error.stack,
      );
      throw error;
    }
  }

  private buildInQuery(ids: string[]): string {
    if (ids.length === 0) return '';
    return ids.map(() => '?').join(',');
  }

  async getUserRank(
    userId: string,
    boardType: LeaderboardType,
    period: LeaderboardPeriod,
  ): Promise<UserRankResponseDto | null> {
    try {
      const user = await this.usersRepo.findOne({ where: { id: userId } });
      if (!user) return null;

      // Get rank from Redis sorted set (real-time)
      const rank = await this.redisService.getUserRank(boardType, period, userId);
      const score = await this.redisService.getUserScore(boardType, period, userId);
      const total = await this.redisService.getTotalCount(boardType, period);

      const percentile = rank && total ? Math.round(((total - rank + 1) / total) * 100) : 0;

      // Get nearby users for context
      const nearbyUsers = rank
        ? await this.redisService.getNearbyUsers(boardType, period, rank, 5)
        : [];

      // Fetch full user details for nearby users
      const nearbyUserIds = nearbyUsers.map(nu => nu.userId);
      const nearbyUsersDetails = await this.usersRepo.findByIds(nearbyUserIds);
      const userDetailsMap = new Map(
        nearbyUsersDetails.map(u => [u.id, u]),
      );

      const nearbyUserDtos = nearbyUsers
        .filter(nu => nu.userId !== userId)
        .map(nu => ({
          rank: nu.rank,
          score: nu.score,
          user: userDetailsMap.get(nu.userId),
          changeFromLastPeriod: 0, // This would come from DB if needed
        } as any));

      return {
        rank,
        percentile,
        score: score ?? 0,
        user: {
          id: user.id,
          username: user.username,
          avatarUrl: user.avatarUrl,
        },
        nearbyUsers: nearbyUserDtos,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching user rank: ${(error as Error).message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getLeaderboardStats(
    boardType: LeaderboardType,
    period: LeaderboardPeriod,
  ): Promise<LeaderboardStatsResponseDto> {
    try {
      const stats = await this.leaderboardRepo.getStatistics(boardType, period);
      const total = await this.redisService.getTotalCount(boardType, period);
      
      // Get top user from Redis
      const topUsers = await this.redisService.getTopUsers(
        boardType,
        period,
        1,
      );
      
      let topUser = null;
      if (topUsers.length > 0) {
        const topUserData = await this.usersRepo.findOne({
          where: { id: topUsers[0].userId },
        });
        if (topUserData) {
          topUser = {
            id: topUserData.id,
            username: topUserData.username,
            avatarUrl: topUserData.avatarUrl,
          };
        }
      }

      return {
        totalParticipants: total || 0,
        topScore: topUsers.length > 0 ? topUsers[0].score : 0,
        topUser,
        avgScore: parseFloat(stats?.avgScore) || 0,
        medianScore: parseFloat(stats?.medianScore) || 0,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching leaderboard stats: ${(error as Error).message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getUserHistory(
    userId: string,
    boardType: LeaderboardType,
    limit: number = 10,
  ): Promise<LeaderboardHistoryResponseDto[]> {
    try {
      const snapshots = await this.snapshotsRepo.getUserHistory(userId, boardType, limit);

      return snapshots.map(snap => ({
        period: snap.period,
        rank: snap.rank,
        score: snap.score,
        rankChange: snap.rankChangeFromPrevious,
        snapshotDate: snap.snapshotDate,
      }));
    } catch (error) {
      this.logger.error(
        `Error fetching user history: ${(error as Error).message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Compute leaderboard rankings from database and update Redis sorted sets
   * This should be called periodically to ensure consistency
   */
  async computeLeaderboard(
    boardType: LeaderboardType,
    period: LeaderboardPeriod,
  ): Promise<void> {
    try {
      this.logger.log(
        `Computing leaderboard for ${boardType}/${period}...`,
      );

      // Get all entries from database for this board/period
      const entries = await this.leaderboardRepo.find({
        where: { boardType, period },
        order: { score: 'DESC' },
      });

      if (entries.length === 0) {
        this.logger.log(
          `No entries to compute for ${boardType}/${period}`,
        );
        return;
      }

      // Clear existing Redis data for this leaderboard
      await this.redisService.clearLeaderboard(boardType, period);

      // Bulk load all scores to Redis sorted set
      const scores = entries.map(e => ({
        userId: e.userId,
        score: e.score,
      }));

      await this.redisService.bulkLoadScores(boardType, period, scores);

      // Update ranks in database from Redis
      const rankedUsers = await this.redisService.getAllUsersWithScores(
        boardType,
        period,
      );

      for (const rankedUser of rankedUsers) {
        const entry = entries.find(e => e.userId === rankedUser.userId);
        if (entry) {
          entry.rank = rankedUser.rank;
          entry.computedAt = new Date();
        }
      }

      await this.leaderboardRepo.save(entries);

      // Invalidate cache
      await this.redisService.invalidateCache(boardType, period);

      this.logger.log(
        `Computed leaderboard for ${boardType}/${period}: ${entries.length} entries`,
      );
    } catch (error) {
      this.logger.error(
        `Error computing leaderboard for ${boardType}/${period}: ${(error as Error)
          .message}`,
        error.stack,
      );
      throw error;
    }
  }

  private getCurrentPeriod(): LeaderboardPeriod {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const dayOfMonth = now.getDate();

    if (dayOfWeek === 0 && dayOfMonth === 1) {
      return LeaderboardPeriod.MONTHLY;
    }

    return LeaderboardPeriod.WEEKLY;
  }

  private getPeriodStartDate(period: LeaderboardPeriod): Date {
    const now = new Date();
    const start = new Date(now);

    if (period === LeaderboardPeriod.WEEKLY) {
      const dayOfWeek = start.getDay();
      const daysToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
      start.setDate(start.getDate() + daysToMonday);
      start.setHours(0, 0, 0, 0);
    } else if (period === LeaderboardPeriod.MONTHLY) {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    } else {
      // ALL_TIME - arbitrary start
      start.setFullYear(2024, 0, 1);
      start.setHours(0, 0, 0, 0);
    }

    return start;
  }

  private getNextResetDate(period: LeaderboardPeriod): Date {
    const now = new Date();

    if (period === LeaderboardPeriod.WEEKLY) {
      const daysUntilSunday = (7 - now.getDay()) % 7;
      const nextReset = new Date(now);
      nextReset.setDate(nextReset.getDate() + daysUntilSunday);
      nextReset.setHours(0, 0, 0, 0);
      return nextReset;
    } else if (period === LeaderboardPeriod.MONTHLY) {
      const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      nextReset.setHours(0, 0, 0, 0);
      return nextReset;
    }

    return new Date(now.getFullYear() + 1, 0, 1);
  }

  private mapEntryToDto(entry: any): LeaderboardEntryResponseDto {
    return {
      id: entry.id,
      boardType: entry.boardType,
      userId: entry.userId,
      username: entry.user?.username || '',
      avatarUrl: entry.user?.avatarUrl || '',
      score: entry.score,
      rank: entry.rank,
      period: entry.period,
      computedAt: entry.computedAt,
      changeFromLastPeriod: entry.changeFromLastPeriod || 0,
    };
  }
}
  async resetWeeklyLeaderboards(): Promise<void> {
    try {
      this.logger.log('Starting weekly leaderboard reset');

      for (const boardType of Object.values(LeaderboardType)) {
        await this.archiveAndResetPeriod(boardType, LeaderboardPeriod.WEEKLY);
      }

      this.logger.log('Weekly leaderboard reset completed');
    } catch (error) {
      this.logger.error(
        `Error resetting weekly leaderboards: ${(error as Error).message}`,
        error.stack,
      );
    }
  }

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT, {
    name: 'resetMonthlyLeaderboards',
  })
  async resetMonthlyLeaderboards(): Promise<void> {
    try {
      this.logger.log('Starting monthly leaderboard reset');

      for (const boardType of Object.values(LeaderboardType)) {
        await this.archiveAndResetPeriod(boardType, LeaderboardPeriod.MONTHLY);
      }

      this.logger.log('Monthly leaderboard reset completed');
    } catch (error) {
      this.logger.error(
        `Error resetting monthly leaderboards: ${(error as Error).message}`,
        error.stack,
      );
    }
  }

  private async archiveAndResetPeriod(
    boardType: LeaderboardType,
    period: LeaderboardPeriod,
  ): Promise<void> {
    try {
      const entries = await this.leaderboardRepo.find({
        where: { boardType, period },
        relations: ['user'],
      });

      if (entries.length === 0) return;

      const snapshotData = entries.map(e => ({
        userId: e.userId,
        boardType: e.boardType,
        period: e.period,
        score: e.score,
        rank: e.rank || 0,
        rankChange: e.changeFromLastPeriod || 0,
      }));

      // Save snapshot for historical comparison
      await this.snapshotsRepo.saveSnapshot(snapshotData, new Date());

      // Reset database entries
      await this.leaderboardRepo.resetPeriodEntries(boardType, period);

      // Clear Redis leaderboard and cache
      await this.redisService.clearLeaderboard(boardType, period);
      await this.redisService.invalidateCache(boardType, period);

      this.logger.log(
        `Archived and reset ${entries.length} entries for ${boardType} ${period}`,
      );
    } catch (error) {
      this.logger.error(
        `Error archiving period for ${boardType} ${period}: ${(error as Error)
          .message}`,
        error.stack,
      );
      throw error;
    }
  }

  private mapEntryToDto(entry: LeaderboardEntry): LeaderboardEntryResponseDto {
    return {
      rank: entry.rank,
      score: entry.score,
      user: {
        id: entry.user.id,
        username: entry.user.username,
        avatarUrl: entry.user.avatarUrl,
      },
      changeFromLastPeriod: entry.changeFromLastPeriod,
    };
  }
}
