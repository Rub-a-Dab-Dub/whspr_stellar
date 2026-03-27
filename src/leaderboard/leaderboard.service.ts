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

      await this.leaderboardRepo.save(entry);
      this.logger.debug(`Updated score for user ${userId} on board ${boardType}: ${entry.score}`);
    } catch (error) {
      this.logger.error(`Error updating user score: ${error.message}`, error.stack);
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
      const entries = await this.leaderboardRepo.findLeaderboard(boardType, period, limit_capped);

      const total = await this.leaderboardRepo.countParticipants(boardType, period);
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
      this.logger.error(`Error fetching leaderboard: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getUserRank(
    userId: string,
    boardType: LeaderboardType,
    period: LeaderboardPeriod,
  ): Promise<UserRankResponseDto | null> {
    try {
      const entry = await this.leaderboardRepo.findUserRank(userId, boardType, period);

      if (!entry) {
        const user = await this.usersRepo.findOne({ where: { id: userId } });
        if (!user) return null;

        return {
          rank: null,
          percentile: 0,
          score: 0,
          user: {
            id: user.id,
            username: user.username,
            avatarUrl: user.avatarUrl,
          },
          nearbyUsers: [],
        };
      }

      const total = await this.leaderboardRepo.countParticipants(boardType, period);
      const percentile = entry.rank ? Math.round(((total - entry.rank + 1) / total) * 100) : 0;

      const nearbyUsers = entry.rank
        ? await this.leaderboardRepo.findNearbyUsers(entry.rank, boardType, period, 5)
        : [];

      return {
        rank: entry.rank,
        percentile,
        score: entry.score,
        user: {
          id: entry.user.id,
          username: entry.user.username,
          avatarUrl: entry.user.avatarUrl,
        },
        nearbyUsers: nearbyUsers
          .filter(e => e.id !== entry.id)
          .map(e => this.mapEntryToDto(e)),
      };
    } catch (error) {
      this.logger.error(`Error fetching user rank: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getLeaderboardStats(
    boardType: LeaderboardType,
    period: LeaderboardPeriod,
  ): Promise<LeaderboardStatsResponseDto> {
    try {
      const stats = await this.leaderboardRepo.getStatistics(boardType, period);
      const topEntry = await this.leaderboardRepo.getTopEntry(boardType, period);

      return {
        totalParticipants: parseInt(stats.count) || 0,
        topScore: parseFloat(stats.maxScore) || 0,
        topUser: topEntry
          ? {
              id: topEntry.user.id,
              username: topEntry.user.username,
              avatarUrl: topEntry.user.avatarUrl,
            }
          : null,
        avgScore: parseFloat(stats.avgScore) || 0,
        medianScore: parseFloat(stats.medianScore) || 0,
      };
    } catch (error) {
      this.logger.error(`Error fetching leaderboard stats: ${error.message}`, error.stack);
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
      this.logger.error(`Error fetching user history: ${error.message}`, error.stack);
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

  @Cron(CronExpression.EVERY_WEEK, { name: 'resetWeeklyLeaderboards' })
  async resetWeeklyLeaderboards(): Promise<void> {
    try {
      this.logger.log('Starting weekly leaderboard reset');

      for (const boardType of Object.values(LeaderboardType)) {
        await this.archiveAndResetPeriod(boardType, LeaderboardPeriod.WEEKLY);
      }

      this.logger.log('Weekly leaderboard reset completed');
    } catch (error) {
      this.logger.error(`Error resetting weekly leaderboards: ${error.message}`, error.stack);
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
      this.logger.error(`Error resetting monthly leaderboards: ${error.message}`, error.stack);
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

      await this.snapshotsRepo.saveSnapshot(snapshotData, new Date());
      await this.leaderboardRepo.resetPeriodEntries(boardType, period);

      this.logger.log(
        `Archived and reset ${entries.length} entries for ${boardType} ${period}`,
      );
    } catch (error) {
      this.logger.error(
        `Error archiving period for ${boardType} ${period}: ${error.message}`,
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
