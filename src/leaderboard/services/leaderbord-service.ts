import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LeaderboardEntry } from './entities/leaderboard-entry.entity';
import {
  LeaderboardCategory,
  LeaderboardTimeframe,
  ILeaderboardEntry,
} from './interfaces/leaderboard.interface';
import { UpdateLeaderboardDto } from './dto/update-leaderboard.dto';
import { GetLeaderboardDto } from './dto/get-leaderboard.dto';

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(
    @InjectRepository(LeaderboardEntry)
    private leaderboardRepository: Repository<LeaderboardEntry>,
  ) {}

  /**
   * Update leaderboard entry for a user
   */
  async updateLeaderboard(dto: UpdateLeaderboardDto): Promise<void> {
    const { userId, category, scoreIncrement, roomId } = dto;

    // Update all timeframes
    const timeframes = [
      LeaderboardTimeframe.DAILY,
      LeaderboardTimeframe.WEEKLY,
      LeaderboardTimeframe.ALL_TIME,
    ];

    for (const timeframe of timeframes) {
      await this.updateEntry(userId, category, scoreIncrement, timeframe, roomId);
    }

    // Recalculate ranks for affected leaderboards
    await this.recalculateRanks(category, roomId);
  }

  /**
   * Update a single leaderboard entry
   */
  private async updateEntry(
    userId: string,
    category: LeaderboardCategory,
    scoreIncrement: number,
    timeframe: LeaderboardTimeframe,
    roomId?: string,
  ): Promise<void> {
    const entry = await this.leaderboardRepository.findOne({
      where: { userId, category, timeframe, roomId: roomId || null },
    });

    if (entry) {
      entry.score = Number(entry.score) + scoreIncrement;
      await this.leaderboardRepository.save(entry);
    } else {
      // Fetch username (you'll need to inject UserService or pass username)
      const username = await this.getUsernameById(userId);
      
      await this.leaderboardRepository.save({
        userId,
        username,
        category,
        timeframe,
        score: scoreIncrement,
        rank: 0,
        roomId: roomId || null,
      });
    }
  }

  /**
   * Get top users from leaderboard
   */
  async getTopUsers(dto: GetLeaderboardDto): Promise<ILeaderboardEntry[]> {
    const { category, timeframe, roomId, limit, offset } = dto;

    const entries = await this.leaderboardRepository.find({
      where: {
        category,
        timeframe: timeframe || LeaderboardTimeframe.ALL_TIME,
        roomId: roomId || null,
      },
      order: { score: 'DESC', updatedAt: 'ASC' },
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
    }));
  }

  /**
   * Get user's rank and position
   */
  async getUserRank(
    userId: string,
    category: LeaderboardCategory,
    timeframe: LeaderboardTimeframe = LeaderboardTimeframe.ALL_TIME,
    roomId?: string,
  ): Promise<ILeaderboardEntry | null> {
    const entry = await this.leaderboardRepository.findOne({
      where: {
        userId,
        category,
        timeframe,
        roomId: roomId || null,
      },
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
    };
  }

  /**
   * Efficient ranking algorithm using SQL
   */
  async recalculateRanks(
    category: LeaderboardCategory,
    roomId?: string,
  ): Promise<void> {
    const timeframes = [
      LeaderboardTimeframe.DAILY,
      LeaderboardTimeframe.WEEKLY,
      LeaderboardTimeframe.ALL_TIME,
    ];

    for (const timeframe of timeframes) {
      // Use SQL window function for efficient ranking
      await this.leaderboardRepository.query(
        `
        UPDATE leaderboard_entries
        SET rank = ranked.new_rank
        FROM (
          SELECT 
            id,
            RANK() OVER (
              PARTITION BY category, timeframe, COALESCE(room_id, '')
              ORDER BY score DESC, updated_at ASC
            ) as new_rank
          FROM leaderboard_entries
          WHERE category = $1 
            AND timeframe = $2
            AND COALESCE(room_id, '') = $3
        ) AS ranked
        WHERE leaderboard_entries.id = ranked.id
        `,
        [category, timeframe, roomId || ''],
      );
    }
  }

  /**
   * Reset daily leaderboards (runs at midnight)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async resetDailyLeaderboards(): Promise<void> {
    this.logger.log('Resetting daily leaderboards...');
    await this.resetLeaderboard(LeaderboardTimeframe.DAILY);
  }

  /**
   * Reset weekly leaderboards (runs every Monday at midnight)
   */
  @Cron(CronExpression.EVERY_WEEK)
  async resetWeeklyLeaderboards(): Promise<void> {
    this.logger.log('Resetting weekly leaderboards...');
    await this.resetLeaderboard(LeaderboardTimeframe.WEEKLY);
  }

  /**
   * Reset leaderboard by timeframe
   */
  async resetLeaderboard(timeframe: LeaderboardTimeframe): Promise<void> {
    // Archive current data before reset (optional - for historical preservation)
    await this.archiveLeaderboardData(timeframe);

    // Reset scores to 0
    await this.leaderboardRepository.update(
      { timeframe },
      { score: 0, rank: 0, lastResetAt: new Date() },
    );

    this.logger.log(`Leaderboard reset completed for ${timeframe}`);
  }

  /**
   * Archive leaderboard data for historical preservation
   */
  private async archiveLeaderboardData(timeframe: LeaderboardTimeframe): Promise<void> {
    const entries = await this.leaderboardRepository.find({
      where: { timeframe },
    });

    // You can save this to a separate archive table or export to external storage
    // For now, just logging
    this.logger.log(`Archiving ${entries.length} entries for ${timeframe}`);
    
    // TODO: Implement actual archiving logic
    // Example: await this.archiveRepository.save(entries);
  }

  /**
   * Get leaderboard statistics
   */
  async getLeaderboardStats(
    category: LeaderboardCategory,
    timeframe: LeaderboardTimeframe,
    roomId?: string,
  ) {
    const result = await this.leaderboardRepository
      .createQueryBuilder('entry')
      .select('COUNT(*)', 'totalUsers')
      .addSelect('SUM(entry.score)', 'totalScore')
      .addSelect('AVG(entry.score)', 'averageScore')
      .addSelect('MAX(entry.score)', 'highestScore')
      .where('entry.category = :category', { category })
      .andWhere('entry.timeframe = :timeframe', { timeframe })
      .andWhere('entry.roomId = :roomId', { roomId: roomId || null })
      .getRawOne();

    return {
      totalUsers: parseInt(result.totalUsers) || 0,
      totalScore: parseFloat(result.totalScore) || 0,
      averageScore: parseFloat(result.averageScore) || 0,
      highestScore: parseFloat(result.highestScore) || 0,
    };
  }

  /**
   * Helper method to get username (inject UserService in real implementation)
   */
  private async getUsernameById(userId: string): Promise<string> {
    // TODO: Inject UserService and fetch actual username
    // For now, return a placeholder
    return `User_${userId.substring(0, 8)}`;
  }

  /**
   * Batch update for multiple users (for efficiency)
   */
  async batchUpdateLeaderboard(updates: UpdateLeaderboardDto[]): Promise<void> {
    // Group updates by category and room for efficient processing
    const grouped = updates.reduce((acc, update) => {
      const key = `${update.category}_${update.roomId || 'global'}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(update);
      return acc;
    }, {} as Record<string, UpdateLeaderboardDto[]>);

    // Process each group
    for (const [key, groupUpdates] of Object.entries(grouped)) {
      for (const update of groupUpdates) {
        await this.updateLeaderboard(update);
      }
    }
  }
}