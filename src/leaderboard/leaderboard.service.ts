import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LeaderboardEntry } from './entities/leaderboard-entry.entity';
import { LeaderboardSnapshot } from './entities/leaderboard-snapshot.entity';
import {
  LeaderboardCategory,
  LeaderboardPeriod,
  ILeaderboardEntry,
} from './leaderboard.interface';
import { UpdateLeaderboardDto } from './dto/update-leaderboard.dto';
import { GetLeaderboardDto } from './dto/get-leaderboard.dto';

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(
    @InjectRepository(LeaderboardEntry)
    private leaderboardRepository: Repository<LeaderboardEntry>,
    @InjectRepository(LeaderboardSnapshot)
    private snapshotRepository: Repository<LeaderboardSnapshot>,
  ) {}

  /**
   * Update leaderboard entry for a user
   */
  async updateLeaderboard(dto: UpdateLeaderboardDto): Promise<void> {
    const { userId, category, scoreIncrement, roomId, username } = dto;

    const periods = [
      LeaderboardPeriod.DAILY,
      LeaderboardPeriod.WEEKLY,
      LeaderboardPeriod.ALL_TIME,
    ];

    for (const period of periods) {
      await this.updateEntry(userId, category, scoreIncrement, period, roomId, username);
    }

    await this.recalculateRanks(category, roomId);
  }

  private async updateEntry(
    userId: string,
    category: LeaderboardCategory,
    scoreIncrement: number,
    period: LeaderboardPeriod,
    roomId?: string,
    username?: string,
  ): Promise<void> {
    const entry = await this.leaderboardRepository.findOne({
      where: { userId, category, timeframe: period, roomId: roomId || null },
    });

    if (entry) {
      entry.score = Number(entry.score) + scoreIncrement;
      if (username) entry.username = username;
      await this.leaderboardRepository.save(entry);
    } else {
      await this.leaderboardRepository.save({
        userId,
        username: username || `User_${userId.substring(0, 8)}`,
        category,
        timeframe: period,
        score: scoreIncrement,
        rank: 0,
        roomId: roomId || null,
      });
    }
  }

  async getTopUsers(dto: GetLeaderboardDto): Promise<ILeaderboardEntry[]> {
    const { category, timeframe, roomId, limit = 50, offset = 0 } = dto;

    const entries = await this.leaderboardRepository.find({
      where: {
        category,
        timeframe: timeframe || LeaderboardPeriod.ALL_TIME,
        roomId: roomId || null,
      },
      order: { isPinned: 'DESC', score: 'DESC', updatedAt: 'ASC' },
      take: limit,
      skip: offset,
    });

    return entries.map(entry => ({
      userId: entry.userId,
      username: entry.username,
      score: Number(entry.score),
      rank: entry.rank,
      category: entry.category,
      timeframe: entry.timeframe,
      roomId: entry.roomId,
      isPinned: entry.isPinned,
    }));
  }

  async recalculateRanks(
    category: LeaderboardCategory,
    roomId?: string,
  ): Promise<void> {
    const periods = [
      LeaderboardPeriod.DAILY,
      LeaderboardPeriod.WEEKLY,
      LeaderboardPeriod.ALL_TIME,
    ];

    for (const period of periods) {
      await this.leaderboardRepository.query(
        `
        UPDATE leaderboard_entries
        SET rank = ranked.new_rank
        FROM (
          SELECT 
            id,
            RANK() OVER (
              PARTITION BY category, timeframe, COALESCE(room_id, '')
              ORDER BY is_pinned DESC, score DESC, updated_at ASC
            ) as new_rank
          FROM leaderboard_entries
          WHERE category = $1 
            AND timeframe = $2
            AND COALESCE(room_id, '') = $3
        ) AS ranked
        WHERE leaderboard_entries.id = ranked.id
        `,
        [category, period, roomId || ''],
      );
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async resetDailyLeaderboards(): Promise<void> {
    await this.adminResetLeaderboard(LeaderboardCategory.XP, LeaderboardPeriod.DAILY, {
      reason: 'Scheduled daily reset',
      snapshotBeforeReset: true,
    });
  }

  /**
   * Admin controlled reset
   */
  async adminResetLeaderboard(
    category: LeaderboardCategory,
    period: LeaderboardPeriod,
    options: { reason: string; snapshotBeforeReset: boolean; adminId?: string; roomId?: string }
  ): Promise<void> {
    if (options.snapshotBeforeReset) {
      await this.createSnapshot(category, period, options.reason, options.adminId, options.roomId);
    }

    await this.leaderboardRepository.update(
      { category, timeframe: period, roomId: options.roomId || null },
      { score: 0, rank: 0, lastResetAt: new Date() },
    );

    this.logger.log(`Leaderboard reset for ${category} (${period}) by ${options.adminId || 'system'}`);
  }

  private async createSnapshot(
    category: LeaderboardCategory,
    period: LeaderboardPeriod,
    reason: string,
    adminId?: string,
    roomId?: string,
  ): Promise<void> {
    const topEntries = await this.leaderboardRepository.find({
      where: { category, timeframe: period, roomId: roomId || null },
      order: { score: 'DESC' },
      take: 100, // Snapshot top 100
    });

    if (topEntries.length === 0) return;

    await this.snapshotRepository.save({
      category,
      period,
      reason,
      resetBy: adminId,
      roomId: roomId || null,
      data: topEntries.map(e => ({
        userId: e.userId,
        username: e.username,
        score: e.score,
        rank: e.rank,
      })),
    });
  }

  async getHistory(limit: number = 50, offset: number = 0): Promise<LeaderboardSnapshot[]> {
    return await this.snapshotRepository.find({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async setPinnedStatus(userId: string, category: LeaderboardCategory, period: LeaderboardPeriod, isPinned: boolean, roomId?: string): Promise<void> {
    const entry = await this.leaderboardRepository.findOne({
      where: { userId, category, timeframe: period, roomId: roomId || null }
    });

    if (!entry) {
      throw new NotFoundException('Leaderboard entry not found');
    }

    entry.isPinned = isPinned;
    await this.leaderboardRepository.save(entry);
    await this.recalculateRanks(category, roomId);
  }

  async getUserRank(
    userId: string,
    category: LeaderboardCategory,
    period: LeaderboardPeriod,
    roomId?: string,
  ): Promise<ILeaderboardEntry | null> {
    const entry = await this.leaderboardRepository.findOne({
      where: { userId, category, timeframe: period, roomId: roomId || null },
    });

    if (!entry) return null;

    return {
      userId: entry.userId,
      username: entry.username,
      score: Number(entry.score),
      rank: entry.rank,
      category: entry.category,
      timeframe: entry.timeframe,
      roomId: entry.roomId,
      isPinned: entry.isPinned,
    };
  }

  async getLeaderboardStats(
    category: LeaderboardCategory,
    period: LeaderboardPeriod,
    roomId?: string,
  ) {
    const result = await this.leaderboardRepository
      .createQueryBuilder('entry')
      .select('COUNT(*)', 'totalUsers')
      .addSelect('SUM(entry.score)', 'totalScore')
      .addSelect('AVG(entry.score)', 'averageScore')
      .addSelect('MAX(entry.score)', 'highestScore')
      .where('entry.category = :category', { category })
      .andWhere('entry.timeframe = :period', { period })
      .andWhere('entry.roomId = :roomId', { roomId: roomId || null })
      .getRawOne();

    return {
      totalUsers: parseInt(result.totalUsers) || 0,
      totalScore: parseFloat(result.totalScore) || 0,
      averageScore: parseFloat(result.averageScore) || 0,
      highestScore: parseFloat(result.highestScore) || 0,
    };
  }
}
