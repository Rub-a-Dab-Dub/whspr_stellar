import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn, 
  Index,
  ManyToOne,
  JoinColumn
} from 'typeorm';

export enum LeaderboardType {
  XP = 'xp',
  TIPS_SENT = 'tips_sent',
  MESSAGES = 'messages',
  ROOMS_CREATED = 'rooms_created'
}

export enum LeaderboardPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  ALL_TIME = 'all_time'
}

@Entity('leaderboards')
@Index(['type', 'period', 'seasonId'])
@Index(['userId', 'type', 'period', 'seasonId'], { unique: true })
export class Leaderboard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: LeaderboardType })
  type: LeaderboardType;

  @Column({ type: 'enum', enum: LeaderboardPeriod })
  period: LeaderboardPeriod;

  @Column({ type: 'integer', default: 0 })
  score: number;

  @Column({ type: 'integer', nullable: true })
  rank: number;

  @Column({ type: 'integer', nullable: true })
  previousRank: number;

  @Column({ type: 'integer', default: 0 })
  rankChange: number; // Positive = moved up, Negative = moved down

  @Column({ type: 'uuid', nullable: true })
  seasonId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastResetAt: Date;
}

@Entity('leaderboard_seasons')
export class LeaderboardSeason {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'timestamp' })
  startDate: Date;

  @Column({ type: 'timestamp' })
  endDate: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('leaderboard_rewards')
export class LeaderboardReward {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: LeaderboardType })
  leaderboardType: LeaderboardType;

  @Column({ type: 'enum', enum: LeaderboardPeriod })
  period: LeaderboardPeriod;

  @Column({ type: 'integer' })
  rank: number;

  @Column({ type: 'integer' })
  score: number;

  @Column({ type: 'jsonb', nullable: true })
  rewardDetails: {
    coins?: number;
    badge?: string;
    title?: string;
    special?: any;
  };

  @Column({ type: 'uuid', nullable: true })
  seasonId: string;

  @Column({ type: 'boolean', default: false })
  claimed: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  claimedAt: Date;
}

@Entity('leaderboard_analytics')
export class LeaderboardAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: LeaderboardType })
  type: LeaderboardType;

  @Column({ type: 'enum', enum: LeaderboardPeriod })
  period: LeaderboardPeriod;

  @Column({ type: 'uuid', nullable: true })
  seasonId: string;

  @Column({ type: 'integer' })
  totalParticipants: number;

  @Column({ type: 'integer' })
  averageScore: number;

  @Column({ type: 'integer' })
  highestScore: number;

  @Column({ type: 'integer' })
  lowestScore: number;

  @Column({ type: 'jsonb', nullable: true })
  topPerformers: Array<{
    userId: string;
    rank: number;
    score: number;
  }>;

  @Column({ type: 'date' })
  snapshotDate: Date;

  @CreateDateColumn()
  createdAt: Date;
}

// ============================================================================
// DTOs
// ============================================================================

export class GetLeaderboardDto {
  type: LeaderboardType;
  period?: LeaderboardPeriod = LeaderboardPeriod.ALL_TIME;
  page?: number = 1;
  limit?: number = 50;
  seasonId?: string;
}

export class LeaderboardEntryDto {
  userId: string;
  username?: string;
  avatar?: string;
  score: number;
  rank: number;
  rankChange: number;
  isCurrentUser?: boolean;
}

export class LeaderboardResponseDto {
  type: LeaderboardType;
  period: LeaderboardPeriod;
  seasonId?: string;
  entries: LeaderboardEntryDto[];
  userRank?: {
    entry: LeaderboardEntryDto;
    rank: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  lastUpdated: Date;
}

// ============================================================================
// LEADERBOARD SERVICE
// ============================================================================

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(
    @InjectRepository(Leaderboard)
    private leaderboardRepo: Repository<Leaderboard>,
    @InjectRepository(LeaderboardSeason)
    private seasonRepo: Repository<LeaderboardSeason>,
    @InjectRepository(LeaderboardReward)
    private rewardRepo: Repository<LeaderboardReward>,
    @InjectRepository(LeaderboardAnalytics)
    private analyticsRepo: Repository<LeaderboardAnalytics>,
    private cacheService: LeaderboardCacheService,
    private rewardService: LeaderboardRewardService,
  ) {}

  /**
   * Get leaderboard rankings with pagination
   */
  async getLeaderboard(
    dto: GetLeaderboardDto,
    currentUserId?: string
  ): Promise<LeaderboardResponseDto> {
    const { type, period, page, limit, seasonId } = dto;
    const skip = (page - 1) * limit;

    // Try to get from cache first
    const cacheKey = this.cacheService.getLeaderboardKey(type, period, seasonId);
    const cached = await this.cacheService.get(cacheKey);
    
    if (cached && !currentUserId) {
      return this.paginateCachedResults(cached, page, limit);
    }

    // Get active season if not specified
    const activeSeason = seasonId 
      ? await this.seasonRepo.findOne({ where: { id: seasonId } })
      : await this.getActiveSeason();

    // Calculate rankings
    await this.calculateRankings(type, period, activeSeason?.id);

    // Fetch leaderboard entries
    const where: any = {
      type,
      period,
      seasonId: activeSeason?.id || null,
    };

    const [entries, total] = await this.leaderboardRepo.findAndCount({
      where,
      order: { rank: 'ASC' },
      take: limit,
      skip,
    });

    // Get user's rank if userId provided
    let userRank = null;
    if (currentUserId) {
      userRank = await this.getUserRank(currentUserId, type, period, activeSeason?.id);
    }

    const response: LeaderboardResponseDto = {
      type,
      period,
      seasonId: activeSeason?.id,
      entries: entries.map(e => this.mapToDto(e, currentUserId)),
      userRank,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      lastUpdated: new Date(),
    };

    // Cache the full results
    await this.cacheService.set(cacheKey, response, 300); // 5 minutes

    return response;
  }

  /**
   * Get user's rank in a specific leaderboard
   */
  async getUserRank(
    userId: string,
    type: LeaderboardType,
    period: LeaderboardPeriod,
    seasonId?: string
  ): Promise<{ entry: LeaderboardEntryDto; rank: number } | null> {
    const entry = await this.leaderboardRepo.findOne({
      where: {
        userId,
        type,
        period,
        seasonId: seasonId || null,
      },
    });

    if (!entry) {
      return null;
    }

    return {
      entry: this.mapToDto(entry, userId),
      rank: entry.rank,
    };
  }

  /**
   * Update user score for a leaderboard type
   */
  async updateScore(
    userId: string,
    type: LeaderboardType,
    increment: number
  ): Promise<void> {
    const activeSeason = await this.getActiveSeason();
    
    // Update all time periods
    for (const period of Object.values(LeaderboardPeriod)) {
      let entry = await this.leaderboardRepo.findOne({
        where: {
          userId,
          type,
          period,
          seasonId: activeSeason?.id || null,
        },
      });

      if (!entry) {
        entry = this.leaderboardRepo.create({
          userId,
          type,
          period,
          score: 0,
          seasonId: activeSeason?.id || null,
        });
      }

      entry.score += increment;
      await this.leaderboardRepo.save(entry);
    }

    // Invalidate cache
    await this.cacheService.invalidateLeaderboard(type);
  }

  /**
   * Calculate rankings for a leaderboard
   */
  async calculateRankings(
    type: LeaderboardType,
    period: LeaderboardPeriod,
    seasonId?: string
  ): Promise<void> {
    const entries = await this.leaderboardRepo.find({
      where: {
        type,
        period,
        seasonId: seasonId || null,
      },
      order: { score: 'DESC' },
    });

    let currentRank = 1;
    let previousScore = -1;
    let sameRankCount = 0;

    for (const entry of entries) {
      const oldRank = entry.rank;

      if (entry.score === previousScore) {
        sameRankCount++;
      } else {
        currentRank += sameRankCount;
        sameRankCount = 1;
      }

      entry.previousRank = oldRank;
      entry.rank = currentRank;
      entry.rankChange = oldRank ? oldRank - currentRank : 0;

      previousScore = entry.score;
    }

    await this.leaderboardRepo.save(entries);
  }

  /**
   * Reset leaderboard for a specific period
   */
  async resetLeaderboard(
    type: LeaderboardType,
    period: LeaderboardPeriod
  ): Promise<void> {
    this.logger.log(`Resetting ${period} leaderboard for ${type}`);

    const activeSeason = await this.getActiveSeason();

    // Save analytics before reset
    await this.captureAnalytics(type, period, activeSeason?.id);

    // Award rewards to top performers
    await this.rewardService.awardTopPerformers(type, period, activeSeason?.id);

    // Reset scores
    await this.leaderboardRepo.update(
      {
        type,
        period,
        seasonId: activeSeason?.id || null,
      },
      {
        score: 0,
        rank: null,
        previousRank: null,
        rankChange: 0,
        lastResetAt: new Date(),
      }
    );

    // Invalidate cache
    await this.cacheService.invalidateLeaderboard(type);

    this.logger.log(`Reset complete for ${period} ${type} leaderboard`);
  }

  /**
   * Capture analytics snapshot
   */
  private async captureAnalytics(
    type: LeaderboardType,
    period: LeaderboardPeriod,
    seasonId?: string
  ): Promise<void> {
    const entries = await this.leaderboardRepo.find({
      where: {
        type,
        period,
        seasonId: seasonId || null,
      },
      order: { rank: 'ASC' },
      take: 10,
    });

    if (entries.length === 0) return;

    const scores = entries.map(e => e.score);
    const analytics = this.analyticsRepo.create({
      type,
      period,
      seasonId,
      totalParticipants: entries.length,
      averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      highestScore: Math.max(...scores),
      lowestScore: Math.min(...scores),
      topPerformers: entries.slice(0, 10).map(e => ({
        userId: e.userId,
        rank: e.rank,
        score: e.score,
      })),
      snapshotDate: new Date(),
    });

    await this.analyticsRepo.save(analytics);
  }

  /**
   * Get active season
   */
  private async getActiveSeason(): Promise<LeaderboardSeason | null> {
    return await this.seasonRepo.findOne({
      where: {
        isActive: true,
        startDate: MoreThan(new Date()),
        endDate: Between(new Date(), new Date('2099-12-31')),
      },
    });
  }

  /**
   * Map entity to DTO
   */
  private mapToDto(
    entry: Leaderboard,
    currentUserId?: string
  ): LeaderboardEntryDto {
    return {
      userId: entry.userId,
      score: entry.score,
      rank: entry.rank,
      rankChange: entry.rankChange,
      isCurrentUser: entry.userId === currentUserId,
    };
  }

  /**
   * Paginate cached results
   */
  private paginateCachedResults(
    cached: LeaderboardResponseDto,
    page: number,
    limit: number
  ): LeaderboardResponseDto {
    const start = (page - 1) * limit;
    const end = start + limit;

    return {
      ...cached,
      entries: cached.entries.slice(start, end),
      pagination: {
        page,
        limit,
        total: cached.entries.length,
        totalPages: Math.ceil(cached.entries.length / limit),
      },
    };
  }

  // ============================================================================
  // SCHEDULED JOBS
  // ============================================================================

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async resetDailyLeaderboards() {
    for (const type of Object.values(LeaderboardType)) {
      await this.resetLeaderboard(type, LeaderboardPeriod.DAILY);
    }
  }

  @Cron(CronExpression.EVERY_WEEK)
  async resetWeeklyLeaderboards() {
    for (const type of Object.values(LeaderboardType)) {
      await this.resetLeaderboard(type, LeaderboardPeriod.WEEKLY);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async recalculateRankings() {
    for (const type of Object.values(LeaderboardType)) {
      for (const period of Object.values(LeaderboardPeriod)) {
        const activeSeason = await this.getActiveSeason();
        await this.calculateRankings(type, period, activeSeason?.id);
      }
    }
  }
}

// ============================================================================
// CACHE SERVICE
// ============================================================================

import { Injectable as InjectableDecorator } from '@nestjs/common';
import { Redis } from 'ioredis';
import { InjectRedis } from '@liaoliaots/nestjs-redis';

@InjectableDecorator()
export class LeaderboardCacheService {
  constructor(
    @InjectRedis() private readonly redis: Redis
  ) {}

  getLeaderboardKey(
    type: LeaderboardType,
    period: LeaderboardPeriod,
    seasonId?: string
  ): string {
    return `leaderboard:${type}:${period}:${seasonId || 'current'}`;
  }

  async get(key: string): Promise<any | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: any, ttl: number = 300): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  async invalidateLeaderboard(type: LeaderboardType): Promise<void> {
    const pattern = `leaderboard:${type}:*`;
    const keys = await this.redis.keys(pattern);
    
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async invalidateAll(): Promise<void> {
    const keys = await this.redis.keys('leaderboard:*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

// ============================================================================
// REWARD SERVICE
// ============================================================================

@InjectableDecorator()
export class LeaderboardRewardService {
  private readonly logger = new Logger(LeaderboardRewardService.name);

  constructor(
    @InjectRepository(Leaderboard)
    private leaderboardRepo: Repository<Leaderboard>,
    @InjectRepository(LeaderboardReward)
    private rewardRepo: Repository<LeaderboardReward>,
  ) {}

  /**
   * Award rewards to top 10 performers
   */
  async awardTopPerformers(
    type: LeaderboardType,
    period: LeaderboardPeriod,
    seasonId?: string
  ): Promise<void> {
    const topPerformers = await this.leaderboardRepo.find({
      where: {
        type,
        period,
        seasonId: seasonId || null,
      },
      order: { rank: 'ASC' },
      take: 10,
    });

    for (const performer of topPerformers) {
      const rewardDetails = this.calculateReward(performer.rank, period);
      
      const reward = this.rewardRepo.create({
        userId: performer.userId,
        leaderboardType: type,
        period,
        rank: performer.rank,
        score: performer.score,
        rewardDetails,
        seasonId,
      });

      await this.rewardRepo.save(reward);
      
      this.logger.log(
        `Awarded rank ${performer.rank} rewards to user ${performer.userId}`
      );
    }
  }

  /**
   * Calculate reward based on rank and period
   */
  private calculateReward(
    rank: number,
    period: LeaderboardPeriod
  ): any {
    const baseRewards = {
      1: { coins: 10000, badge: 'gold_champion', title: '🥇 Champion' },
      2: { coins: 7500, badge: 'silver_champion', title: '🥈 Runner-up' },
      3: { coins: 5000, badge: 'bronze_champion', title: '🥉 Third Place' },
      4: { coins: 3000, badge: 'top_10', title: '🏆 Top 10' },
      5: { coins: 2500, badge: 'top_10', title: '🏆 Top 10' },
      6: { coins: 2000, badge: 'top_10', title: '🏆 Top 10' },
      7: { coins: 1750, badge: 'top_10', title: '🏆 Top 10' },
      8: { coins: 1500, badge: 'top_10', title: '🏆 Top 10' },
      9: { coins: 1250, badge: 'top_10', title: '🏆 Top 10' },
      10: { coins: 1000, badge: 'top_10', title: '🏆 Top 10' },
    };

    const reward = baseRewards[rank] || { coins: 500, badge: 'participant' };

    // Multiply rewards based on period
    const multiplier = {
      [LeaderboardPeriod.DAILY]: 1,
      [LeaderboardPeriod.WEEKLY]: 3,
      [LeaderboardPeriod.ALL_TIME]: 10,
    };

    return {
      ...reward,
      coins: reward.coins * (multiplier[period] || 1),
    };
  }
}

// ============================================================================
// CONTROLLER
// ============================================================================

import { 
  Controller, 
  Get, 
  Param, 
  Query, 
  UseGuards,
  Request 
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse,
  ApiBearerAuth 
} from '@nestjs/swagger';

@ApiTags('Leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get(':type')
  @ApiOperation({ summary: 'Get leaderboard by type' })
  @ApiResponse({ 
    status: 200, 
    description: 'Leaderboard retrieved successfully',
    type: LeaderboardResponseDto 
  })
  async getLeaderboard(
    @Param('type') type: LeaderboardType,
    @Query('period') period?: LeaderboardPeriod,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
    @Query('seasonId') seasonId?: string,
    @Request() req?: any
  ): Promise<LeaderboardResponseDto> {
    const dto: GetLeaderboardDto = {
      type,
      period: period || LeaderboardPeriod.ALL_TIME,
      page: Number(page),
      limit: Math.min(Number(limit), 100), // Max 100 per page
      seasonId,
    };

    const userId = req?.user?.id;
    return await this.leaderboardService.getLeaderboard(dto, userId);
  }

  @Get(':type/rank/:userId')
  @ApiOperation({ summary: 'Get specific user rank' })
  async getUserRank(
    @Param('type') type: LeaderboardType,
    @Param('userId') userId: string,
    @Query('period') period?: LeaderboardPeriod,
    @Query('seasonId') seasonId?: string
  ) {
    return await this.leaderboardService.getUserRank(
      userId,
      type,
      period || LeaderboardPeriod.ALL_TIME,
      seasonId
    );
  }
}

// ============================================================================
// MODULE
// ============================================================================

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { RedisModule } from '@liaoliaots/nestjs-redis';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Leaderboard,
      LeaderboardSeason,
      LeaderboardReward,
      LeaderboardAnalytics,
    ]),
    ScheduleModule.forRoot(),
    RedisModule.forRoot({
      config: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
      },
    }),
  ],
  controllers: [LeaderboardController],
  providers: [
    LeaderboardService,
    LeaderboardCacheService,
    LeaderboardRewardService,
  ],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
