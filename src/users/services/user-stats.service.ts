import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { CacheService } from '../../cache/cache.service';
import { UserStats } from '../entities/user-stats.entity';
import { UserStatsDaily } from '../entities/user-stats-daily.entity';
import { UserStatsWeekly } from '../entities/user-stats-weekly.entity';

type StatsIncrements = Partial<{
  messagesSent: number;
  roomsCreated: number;
  roomsJoined: number;
  tipsSent: number;
  tipsReceived: number;
  tokensTransferred: number;
}>;

@Injectable()
export class UserStatsService {
  private readonly CACHE_TTL_SECONDS = 300;

  constructor(
    @InjectRepository(UserStats)
    private readonly statsRepository: Repository<UserStats>,
    @InjectRepository(UserStatsDaily)
    private readonly dailyRepository: Repository<UserStatsDaily>,
    @InjectRepository(UserStatsWeekly)
    private readonly weeklyRepository: Repository<UserStatsWeekly>,
    private readonly cacheService: CacheService,
  ) {}

  async recordMessageSent(
    userId: string,
    options?: { isTip?: boolean; tipRecipientId?: string; tipAmount?: number },
  ): Promise<void> {
    const increments: StatsIncrements = { messagesSent: 1 };
    if (options?.isTip) {
      increments.tipsSent = 1;
      if (options.tipAmount) {
        increments.tokensTransferred = options.tipAmount;
      }
    }

    await this.applyIncrements(userId, increments, true);

    if (options?.isTip && options.tipRecipientId && options.tipRecipientId !== userId) {
      const recipientIncrements: StatsIncrements = { tipsReceived: 1 };
      if (options.tipAmount) {
        recipientIncrements.tokensTransferred = options.tipAmount;
      }
      await this.applyIncrements(options.tipRecipientId, recipientIncrements, false);
    }
  }

  async recordRoomCreated(userId: string): Promise<void> {
    await this.applyIncrements(userId, { roomsCreated: 1 }, true);
  }

  async recordRoomJoined(userId: string): Promise<void> {
    await this.applyIncrements(userId, { roomsJoined: 1 }, true);
  }

  async recordTokensTransferred(userId: string, amount: number, markActive: boolean): Promise<void> {
    await this.applyIncrements(userId, { tokensTransferred: amount }, markActive);
  }

  async getStatsForUser(userId: string, includeComparison: boolean = true) {
    const cacheKey = this.getCacheKey(userId, includeComparison);
    return this.cacheService.wrap(
      cacheKey,
      async () => {
        const stats = await this.getOrCreateStats(userId);
        const today = this.getStartOfDay(new Date());
        const todayDaily = await this.dailyRepository.findOne({
          where: { userId, date: today },
        });
        const weeklyComparison = includeComparison
          ? await this.getWeeklyComparison(userId, today)
          : null;

        return {
          userId,
          totals: {
            messagesSent: stats.messagesSent,
            roomsCreated: stats.roomsCreated,
            roomsJoined: stats.roomsJoined,
            tipsSent: stats.tipsSent,
            tipsReceived: stats.tipsReceived,
            tokensTransferred: stats.tokensTransferred,
          },
          activeToday: todayDaily?.isActive || false,
          lastActiveAt: stats.lastActiveAt,
          weekOverWeek: weeklyComparison,
        };
      },
      this.CACHE_TTL_SECONDS,
    );
  }

  async exportStats(userId: string, format: 'json' | 'csv' = 'json') {
    const stats = await this.getStatsForUser(userId, true);
    if (format === 'json') {
      return stats;
    }

    const comparison = stats.weekOverWeek;
    const rows = [
      ['metric', 'total', 'current_week', 'previous_week', 'wow_percent'],
      [
        'messages_sent',
        stats.totals.messagesSent,
        comparison?.currentWeek.messagesSent ?? 0,
        comparison?.previousWeek.messagesSent ?? 0,
        comparison?.percentChange.messagesSent ?? 0,
      ],
      [
        'rooms_created',
        stats.totals.roomsCreated,
        comparison?.currentWeek.roomsCreated ?? 0,
        comparison?.previousWeek.roomsCreated ?? 0,
        comparison?.percentChange.roomsCreated ?? 0,
      ],
      [
        'rooms_joined',
        stats.totals.roomsJoined,
        comparison?.currentWeek.roomsJoined ?? 0,
        comparison?.previousWeek.roomsJoined ?? 0,
        comparison?.percentChange.roomsJoined ?? 0,
      ],
      [
        'tips_sent',
        stats.totals.tipsSent,
        comparison?.currentWeek.tipsSent ?? 0,
        comparison?.previousWeek.tipsSent ?? 0,
        comparison?.percentChange.tipsSent ?? 0,
      ],
      [
        'tips_received',
        stats.totals.tipsReceived,
        comparison?.currentWeek.tipsReceived ?? 0,
        comparison?.previousWeek.tipsReceived ?? 0,
        comparison?.percentChange.tipsReceived ?? 0,
      ],
      [
        'tokens_transferred',
        stats.totals.tokensTransferred,
        comparison?.currentWeek.tokensTransferred ?? '0',
        comparison?.previousWeek.tokensTransferred ?? '0',
        comparison?.percentChange.tokensTransferred ?? 0,
      ],
    ];

    return rows.map((row) => row.join(',')).join('\n');
  }

  async aggregateDailyStats(referenceDate: Date = new Date()): Promise<void> {
    const yesterday = this.getStartOfDay(referenceDate);
    yesterday.setDate(yesterday.getDate() - 1);

    const dailyStats = await this.dailyRepository.find({
      where: { date: yesterday },
    });

    for (const stat of dailyStats) {
      if (!stat.isActive && this.hasActivity(stat)) {
        stat.isActive = true;
        await this.dailyRepository.save(stat);
      }
    }
  }

  async aggregateWeeklyStats(referenceDate: Date = new Date()): Promise<void> {
    const currentWeekStart = this.getWeekStart(referenceDate);
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const previousWeekEnd = new Date(currentWeekStart);
    previousWeekEnd.setDate(previousWeekEnd.getDate() - 1);

    const dailyStats = await this.dailyRepository.find({
      where: { date: Between(previousWeekStart, previousWeekEnd) },
    });

    const grouped = new Map<string, UserStatsWeekly>();
    for (const daily of dailyStats) {
      const existing = grouped.get(daily.userId);
      if (existing) {
        this.mergeStats(existing, daily);
      } else {
        const weekly = this.weeklyRepository.create({
          userId: daily.userId,
          weekStart: previousWeekStart,
          weekEnd: previousWeekEnd,
          messagesSent: daily.messagesSent,
          roomsCreated: daily.roomsCreated,
          roomsJoined: daily.roomsJoined,
          tipsSent: daily.tipsSent,
          tipsReceived: daily.tipsReceived,
          tokensTransferred: daily.tokensTransferred,
        });
        grouped.set(daily.userId, weekly);
      }
    }

    for (const weekly of grouped.values()) {
      const existing = await this.weeklyRepository.findOne({
        where: { userId: weekly.userId, weekStart: weekly.weekStart },
      });

      if (existing) {
        existing.weekEnd = weekly.weekEnd;
        existing.messagesSent = weekly.messagesSent;
        existing.roomsCreated = weekly.roomsCreated;
        existing.roomsJoined = weekly.roomsJoined;
        existing.tipsSent = weekly.tipsSent;
        existing.tipsReceived = weekly.tipsReceived;
        existing.tokensTransferred = weekly.tokensTransferred;
        await this.weeklyRepository.save(existing);
      } else {
        await this.weeklyRepository.save(weekly as UserStatsWeekly);
      }
    }
  }

  private async applyIncrements(
    userId: string,
    increments: StatsIncrements,
    markActive: boolean,
  ): Promise<void> {
    const stats = await this.getOrCreateStats(userId);
    const today = this.getStartOfDay(new Date());
    const daily = await this.getOrCreateDailyStats(userId, today);

    stats.messagesSent += increments.messagesSent || 0;
    stats.roomsCreated += increments.roomsCreated || 0;
    stats.roomsJoined += increments.roomsJoined || 0;
    stats.tipsSent += increments.tipsSent || 0;
    stats.tipsReceived += increments.tipsReceived || 0;
    stats.tokensTransferred = this.addTokens(
      stats.tokensTransferred,
      increments.tokensTransferred || 0,
    );

    daily.messagesSent += increments.messagesSent || 0;
    daily.roomsCreated += increments.roomsCreated || 0;
    daily.roomsJoined += increments.roomsJoined || 0;
    daily.tipsSent += increments.tipsSent || 0;
    daily.tipsReceived += increments.tipsReceived || 0;
    daily.tokensTransferred = this.addTokens(
      daily.tokensTransferred,
      increments.tokensTransferred || 0,
    );

    if (markActive) {
      stats.lastActiveAt = new Date();
      daily.isActive = true;
    }

    await this.statsRepository.save(stats);
    await this.dailyRepository.save(daily);
    await this.invalidateCache(userId);
  }

  private async getOrCreateStats(userId: string): Promise<UserStats> {
    const existing = await this.statsRepository.findOne({ where: { userId } });
    if (existing) return existing;

    const created = this.statsRepository.create({
      userId,
      lastActiveAt: null,
      tokensTransferred: '0',
    });
    return this.statsRepository.save(created);
  }

  private async getOrCreateDailyStats(userId: string, date: Date): Promise<UserStatsDaily> {
    const existing = await this.dailyRepository.findOne({ where: { userId, date } });
    if (existing) return existing;

    const created = this.dailyRepository.create({
      userId,
      date,
      tokensTransferred: '0',
      isActive: false,
    });
    return this.dailyRepository.save(created);
  }

  private async getWeeklyComparison(userId: string, today: Date) {
    const currentWeekStart = this.getWeekStart(today);
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);

    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const previousWeekEnd = new Date(currentWeekStart);
    previousWeekEnd.setDate(previousWeekEnd.getDate() - 1);

    const currentWeek = await this.sumDailyStats(
      userId,
      currentWeekStart,
      today,
    );
    const previousWeek =
      (await this.getWeeklySnapshot(userId, previousWeekStart)) ||
      (await this.sumDailyStats(userId, previousWeekStart, previousWeekEnd));

    const percentChange = {
      messagesSent: this.calculatePercentChange(
        previousWeek.messagesSent,
        currentWeek.messagesSent,
      ),
      roomsCreated: this.calculatePercentChange(
        previousWeek.roomsCreated,
        currentWeek.roomsCreated,
      ),
      roomsJoined: this.calculatePercentChange(
        previousWeek.roomsJoined,
        currentWeek.roomsJoined,
      ),
      tipsSent: this.calculatePercentChange(
        previousWeek.tipsSent,
        currentWeek.tipsSent,
      ),
      tipsReceived: this.calculatePercentChange(
        previousWeek.tipsReceived,
        currentWeek.tipsReceived,
      ),
      tokensTransferred: this.calculatePercentChange(
        parseFloat(previousWeek.tokensTransferred),
        parseFloat(currentWeek.tokensTransferred),
      ),
    };

    return {
      currentWeek: {
        range: {
          start: currentWeekStart,
          end: today,
        },
        ...currentWeek,
      },
      previousWeek: {
        range: {
          start: previousWeekStart,
          end: previousWeekEnd,
        },
        ...previousWeek,
      },
      percentChange,
    };
  }

  private async getWeeklySnapshot(
    userId: string,
    weekStart: Date,
  ): Promise<{
    messagesSent: number;
    roomsCreated: number;
    roomsJoined: number;
    tipsSent: number;
    tipsReceived: number;
    tokensTransferred: string;
  } | null> {
    const weekly = await this.weeklyRepository.findOne({
      where: { userId, weekStart },
    });
    if (!weekly) return null;

    return {
      messagesSent: weekly.messagesSent,
      roomsCreated: weekly.roomsCreated,
      roomsJoined: weekly.roomsJoined,
      tipsSent: weekly.tipsSent,
      tipsReceived: weekly.tipsReceived,
      tokensTransferred: weekly.tokensTransferred,
    };
  }

  private async sumDailyStats(
    userId: string,
    start: Date,
    end: Date,
  ): Promise<{
    messagesSent: number;
    roomsCreated: number;
    roomsJoined: number;
    tipsSent: number;
    tipsReceived: number;
    tokensTransferred: string;
  }> {
    const rows = await this.dailyRepository.find({
      where: { userId, date: Between(start, end) },
    });

    return rows.reduce(
      (acc, row) => {
        acc.messagesSent += row.messagesSent;
        acc.roomsCreated += row.roomsCreated;
        acc.roomsJoined += row.roomsJoined;
        acc.tipsSent += row.tipsSent;
        acc.tipsReceived += row.tipsReceived;
        acc.tokensTransferred = this.addTokens(
          acc.tokensTransferred,
          parseFloat(row.tokensTransferred || '0'),
        );
        return acc;
      },
      {
        messagesSent: 0,
        roomsCreated: 0,
        roomsJoined: 0,
        tipsSent: 0,
        tipsReceived: 0,
        tokensTransferred: '0',
      },
    );
  }

  private hasActivity(stat: UserStatsDaily): boolean {
    return (
      stat.messagesSent > 0 ||
      stat.roomsCreated > 0 ||
      stat.roomsJoined > 0 ||
      stat.tipsSent > 0 ||
      stat.tipsReceived > 0 ||
      parseFloat(stat.tokensTransferred || '0') > 0
    );
  }

  private mergeStats(target: UserStatsWeekly, source: UserStatsDaily): void {
    target.messagesSent += source.messagesSent;
    target.roomsCreated += source.roomsCreated;
    target.roomsJoined += source.roomsJoined;
    target.tipsSent += source.tipsSent;
    target.tipsReceived += source.tipsReceived;
    target.tokensTransferred = this.addTokens(
      target.tokensTransferred,
      parseFloat(source.tokensTransferred || '0'),
    );
  }

  private getStartOfDay(date: Date): Date {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private getWeekStart(date: Date): Date {
    const start = this.getStartOfDay(date);
    const day = start.getDay(); // 0 = Sunday
    const diff = (day + 6) % 7; // Monday as week start
    start.setDate(start.getDate() - diff);
    return start;
  }

  private addTokens(current: string | number | null, delta: number): string {
    const currentValue = current ? parseFloat(current.toString()) : 0;
    const next = currentValue + delta;
    return next.toFixed(8);
  }

  private calculatePercentChange(previous: number, current: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    const change = ((current - previous) / previous) * 100;
    return parseFloat(change.toFixed(2));
  }

  private async invalidateCache(userId: string): Promise<void> {
    await Promise.all([
      this.cacheService.delete(this.getCacheKey(userId, true)),
      this.cacheService.delete(this.getCacheKey(userId, false)),
      this.cacheService.delete(this.getExportCacheKey(userId, 'json')),
      this.cacheService.delete(this.getExportCacheKey(userId, 'csv')),
    ]);
  }

  private getCacheKey(userId: string, includeComparison: boolean): string {
    return `user:stats:${userId}:${includeComparison ? 'with_comparison' : 'basic'}`;
  }

  private getExportCacheKey(userId: string, format: string): string {
    return `user:stats:${userId}:export:${format}`;
  }
}
