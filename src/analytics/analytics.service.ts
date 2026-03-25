import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { AnalyticsRangeDto } from './dto/analytics-range.dto';
import { AnalyticsEvent } from './entities/analytics-event.entity';
import { DailyMetric } from './entities/daily-metric.entity';

type DateRange = {
  start: string;
  end: string;
};

type AnalyticsRangeInput = AnalyticsRangeDto | DateRange;

type TrackEventMetadata = Record<string, unknown> & {
  idempotencyKey?: string;
  token?: string;
  amount?: string | number;
};

type DailyMetricPayload = {
  date: string;
  metricKey: string;
  value: string;
  metadata: Record<string, unknown>;
};

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly cacheTtlMs = 300_000;
  private readonly defaultAdminWindowDays = 90;
  private readonly mauWindowDays = 30;
  private readonly metricKeyMap: Record<string, string> = {
    message_sent: 'messages_sent',
    messages_sent: 'messages_sent',
    transfer_initiated: 'transfers_initiated',
    transfers_initiated: 'transfers_initiated',
    group_created: 'groups_created',
    groups_created: 'groups_created',
    new_user: 'new_users',
    new_users: 'new_users',
  };

  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly analyticsEventRepository: Repository<AnalyticsEvent>,
    @InjectRepository(DailyMetric)
    private readonly dailyMetricRepository: Repository<DailyMetric>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async trackEvent(
    eventType: string,
    userId?: string | null,
    metadata: TrackEventMetadata = {},
  ): Promise<AnalyticsEvent> {
    const metricKey = this.normalizeMetricKey(eventType);
    const idempotencyKey =
      typeof metadata.idempotencyKey === 'string' && metadata.idempotencyKey.trim().length > 0
        ? metadata.idempotencyKey.trim()
        : null;

    if (idempotencyKey) {
      const existingEvent = await this.analyticsEventRepository.findOne({
        where: { idempotencyKey },
      });
      if (existingEvent) {
        return existingEvent;
      }
    }

    const event = this.analyticsEventRepository.create({
      eventType: eventType.trim().toLowerCase(),
      metricKey,
      userId: userId ?? null,
      idempotencyKey,
      metadata,
    });

    const savedEvent = await this.analyticsEventRepository.save(event);
    await this.invalidateAnalyticsCache(userId ?? undefined);

    return savedEvent;
  }

  async getDailyMetrics(range: AnalyticsRangeInput = {}): Promise<DailyMetric[]> {
    const normalizedRange = this.normalizeRange(range, this.defaultAdminWindowDays);

    return this.dailyMetricRepository
      .createQueryBuilder('metric')
      .where('metric.date >= :startDate AND metric.date <= :endDate', {
        startDate: normalizedRange.start,
        endDate: normalizedRange.end,
      })
      .orderBy('metric.date', 'ASC')
      .addOrderBy('metric.metricKey', 'ASC')
      .getMany();
  }

  async getUserStats(userId: string): Promise<Record<string, unknown>> {
    const cacheKey = `analytics:users:${userId}`;

    return this.withCache(cacheKey, async () => {
      const totals = await this.analyticsEventRepository
        .createQueryBuilder('event')
        .select('event.metricKey', 'metricKey')
        .addSelect('COUNT(*)', 'count')
        .where('event.userId = :userId', { userId })
        .groupBy('event.metricKey')
        .getRawMany<{ metricKey: string; count: string }>();

      const transferVolumes = await this.analyticsEventRepository
        .createQueryBuilder('event')
        .select("COALESCE(event.metadata->>'token', 'unknown')", 'token')
        .addSelect(
          `COALESCE(SUM(
            CASE
              WHEN (event.metadata->>'amount') ~ '^-?[0-9]+(\\.[0-9]+)?$'
              THEN CAST(event.metadata->>'amount' AS numeric)
              ELSE 0
            END
          ), 0)`,
          'volume',
        )
        .where('event.userId = :userId', { userId })
        .andWhere('event.metricKey = :metricKey', { metricKey: 'transfers_initiated' })
        .groupBy("COALESCE(event.metadata->>'token', 'unknown')")
        .orderBy('token', 'ASC')
        .getRawMany<{ token: string; volume: string }>();

      const activity = await this.analyticsEventRepository
        .createQueryBuilder('event')
        .select('COUNT(DISTINCT DATE(event."createdAt"))', 'activeDays')
        .addSelect('MAX(event."createdAt")', 'lastActiveAt')
        .where('event.userId = :userId', { userId })
        .getRawOne<{ activeDays: string; lastActiveAt: Date | null }>();

      return {
        userId,
        totals: totals.reduce<Record<string, number>>((acc, row) => {
          acc[row.metricKey] = Number(row.count);
          return acc;
        }, {}),
        transferVolumes: transferVolumes.map((row) => ({
          token: row.token,
          volume: row.volume,
        })),
        activeDays: Number(activity?.activeDays ?? 0),
        lastActiveAt: activity?.lastActiveAt ?? null,
      };
    });
  }

  async getPlatformStats(range?: AnalyticsRangeDto): Promise<Record<string, unknown>> {
    const normalizedRange = this.normalizeRange(range, this.defaultAdminWindowDays);
    const cacheKey = this.buildPlatformCacheKey(normalizedRange);

    return this.withCache(cacheKey, async () => {
      const metrics = await this.getDailyMetrics(normalizedRange);
      const totals = metrics.reduce<Record<string, number>>((acc, metric) => {
        if (metric.metricKey === 'transfer_volume') {
          return acc;
        }

        acc[metric.metricKey] = (acc[metric.metricKey] ?? 0) + Number(metric.value);
        return acc;
      }, {});

      const currentDau = await this.getDistinctActiveUserCount(
        this.toUtcDate(this.todayIso()),
        this.toUtcDate(this.addDaysIso(this.todayIso(), 1)),
      );
      const currentMau = await this.calculateMau(this.todayIso());
      const totalUsers = await this.userRepository.count();

      return {
        range: normalizedRange,
        totals,
        totalUsers,
        currentDau,
        currentMau,
        dailyMetrics: metrics.map((metric) => ({
          date: metric.date,
          metricKey: metric.metricKey,
          value: metric.value,
          metadata: metric.metadata,
        })),
      };
    });
  }

  async getTransferVolume(
    token?: string,
    range?: AnalyticsRangeDto,
  ): Promise<Record<string, unknown>> {
    const normalizedRange = this.normalizeRange(range, this.defaultAdminWindowDays);
    const cacheKey = this.buildTransferCacheKey(token, normalizedRange);

    return this.withCache(cacheKey, async () => {
      const query = this.dailyMetricRepository
        .createQueryBuilder('metric')
        .where('metric.metricKey = :metricKey', { metricKey: 'transfer_volume' })
        .andWhere('metric.date >= :startDate AND metric.date <= :endDate', {
          startDate: normalizedRange.start,
          endDate: normalizedRange.end,
        });

      if (token) {
        query.andWhere("metric.metadata->>'token' = :token", { token });
      }

      const metrics = await query.orderBy('metric.date', 'ASC').getMany();
      const totalsByToken = metrics.reduce<Record<string, number>>((acc, metric) => {
        const metricToken = String(metric.metadata.token ?? 'unknown');
        acc[metricToken] = (acc[metricToken] ?? 0) + Number(metric.value);
        return acc;
      }, {});

      return {
        range: normalizedRange,
        token: token ?? null,
        totalsByToken,
        daily: metrics.map((metric) => ({
          date: metric.date,
          token: String(metric.metadata.token ?? 'unknown'),
          volume: metric.value,
        })),
      };
    });
  }

  async getActiveUsers(range?: AnalyticsRangeDto): Promise<Record<string, unknown>> {
    const normalizedRange = this.normalizeRange(range, this.defaultAdminWindowDays);
    const activeMetrics = await this.dailyMetricRepository
      .createQueryBuilder('metric')
      .where('metric.metricKey = :metricKey', { metricKey: 'active_users' })
      .andWhere('metric.date >= :startDate AND metric.date <= :endDate', {
        startDate: normalizedRange.start,
        endDate: normalizedRange.end,
      })
      .orderBy('metric.date', 'ASC')
      .getMany();

    const newUserMetrics = await this.dailyMetricRepository
      .createQueryBuilder('metric')
      .where('metric.metricKey = :metricKey', { metricKey: 'new_users' })
      .andWhere('metric.date >= :startDate AND metric.date <= :endDate', {
        startDate: normalizedRange.start,
        endDate: normalizedRange.end,
      })
      .orderBy('metric.date', 'ASC')
      .getMany();

    return {
      range: normalizedRange,
      currentDau: await this.getDistinctActiveUserCount(
        this.toUtcDate(this.todayIso()),
        this.toUtcDate(this.addDaysIso(this.todayIso(), 1)),
      ),
      currentMau: await this.calculateMau(this.todayIso()),
      dailyActiveUsers: activeMetrics.map((metric) => ({
        date: metric.date,
        value: Number(metric.value),
      })),
      dailyNewUsers: newUserMetrics.map((metric) => ({
        date: metric.date,
        value: Number(metric.value),
      })),
    };
  }

  async aggregateDailyMetrics(targetDate = this.addDaysIso(this.todayIso(), -1)): Promise<number> {
    const start = this.toUtcDate(targetDate);
    const end = this.toUtcDate(this.addDaysIso(targetDate, 1));

    const eventCounts = await this.analyticsEventRepository
      .createQueryBuilder('event')
      .select('event.metricKey', 'metricKey')
      .addSelect('COUNT(*)', 'value')
      .where('event.createdAt >= :start AND event.createdAt < :end', { start, end })
      .groupBy('event.metricKey')
      .getRawMany<{ metricKey: string; value: string }>();

    const activeUsers = await this.getDistinctActiveUserCount(start, end);
    const transferVolumes = await this.analyticsEventRepository
      .createQueryBuilder('event')
      .select("COALESCE(event.metadata->>'token', 'unknown')", 'token')
      .addSelect(
        `COALESCE(SUM(
          CASE
            WHEN (event.metadata->>'amount') ~ '^-?[0-9]+(\\.[0-9]+)?$'
            THEN CAST(event.metadata->>'amount' AS numeric)
            ELSE 0
          END
        ), 0)`,
        'value',
      )
      .where('event.createdAt >= :start AND event.createdAt < :end', { start, end })
      .andWhere('event.metricKey = :metricKey', { metricKey: 'transfers_initiated' })
      .groupBy("COALESCE(event.metadata->>'token', 'unknown')")
      .orderBy('token', 'ASC')
      .getRawMany<{ token: string; value: string }>();

    await this.dailyMetricRepository.delete({ date: targetDate });

    const metricsToPersist: DailyMetricPayload[] = [
      ...eventCounts.map((row) => ({
        date: targetDate,
        metricKey: row.metricKey,
        value: row.value,
        metadata: {},
      })),
      {
        date: targetDate,
        metricKey: 'active_users',
        value: String(activeUsers),
        metadata: { aggregation: 'distinct_user_id' },
      },
      ...transferVolumes.map((row) => ({
        date: targetDate,
        metricKey: 'transfer_volume',
        value: row.value,
        metadata: { token: row.token },
      })),
    ];

    if (metricsToPersist.length > 0) {
      await this.dailyMetricRepository.save(
        metricsToPersist.map((metric) => this.dailyMetricRepository.create(metric)),
      );
    }

    await this.invalidateAnalyticsCache();

    return metricsToPersist.length;
  }

  normalizeMetricKey(eventType: string): string {
    const normalized = eventType
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    return this.metricKeyMap[normalized] ?? normalized;
  }

  private async calculateMau(endDateIso: string): Promise<number> {
    const startDateIso = this.addDaysIso(endDateIso, -(this.mauWindowDays - 1));

    return this.getDistinctActiveUserCount(
      this.toUtcDate(startDateIso),
      this.toUtcDate(this.addDaysIso(endDateIso, 1)),
    );
  }

  private async getDistinctActiveUserCount(start: Date, end: Date): Promise<number> {
    const result = await this.analyticsEventRepository
      .createQueryBuilder('event')
      .select('COUNT(DISTINCT event.userId)', 'value')
      .where('event.userId IS NOT NULL')
      .andWhere('event.createdAt >= :start AND event.createdAt < :end', { start, end })
      .getRawOne<{ value: string }>();

    return Number(result?.value ?? 0);
  }

  private normalizeRange(range: AnalyticsRangeInput = {}, defaultWindowDays: number): DateRange {
    const startDate = this.isAnalyticsRangeDto(range) ? range.startDate : range.start;
    const endDate = this.isAnalyticsRangeDto(range) ? range.endDate : range.end;
    const end = endDate ? this.toDateOnly(endDate) : this.todayIso();
    const start = startDate
      ? this.toDateOnly(startDate)
      : this.addDaysIso(end, -(defaultWindowDays - 1));

    if (start > end) {
      return { start: end, end: start };
    }

    return { start, end };
  }

  private toDateOnly(value: string): string {
    return value.slice(0, 10);
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private addDaysIso(dateIso: string, days: number): string {
    const date = this.toUtcDate(dateIso);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  private toUtcDate(dateIso: string): Date {
    return new Date(`${dateIso}T00:00:00.000Z`);
  }

  private async withCache<T>(cacheKey: string, compute: () => Promise<T>): Promise<T> {
    const cached = await this.cacheManager.get<T>(cacheKey);
    if (cached) {
      return cached;
    }

    const value = await compute();
    await this.cacheManager.set(cacheKey, value, this.cacheTtlMs);
    return value;
  }

  private async invalidateAnalyticsCache(userId?: string): Promise<void> {
    const keys = ['analytics:platform', 'analytics:transfers'];
    if (userId) {
      keys.push(`analytics:users:${userId}`);
    }

    await Promise.all(
      keys.map(async (key) => {
        try {
          await this.cacheManager.del(key);
        } catch (error) {
          this.logger.warn(`Failed to invalidate cache key ${key}: ${String(error)}`);
        }
      }),
    );
  }

  private buildPlatformCacheKey(range: DateRange): string {
    const defaultRange = this.normalizeRange({}, this.defaultAdminWindowDays);
    if (range.start === defaultRange.start && range.end === defaultRange.end) {
      return 'analytics:platform';
    }

    return `analytics:platform:${range.start}:${range.end}`;
  }

  private buildTransferCacheKey(token: string | undefined, range: DateRange): string {
    const defaultRange = this.normalizeRange({}, this.defaultAdminWindowDays);
    if (!token && range.start === defaultRange.start && range.end === defaultRange.end) {
      return 'analytics:transfers';
    }

    return token
      ? `analytics:transfers:${token}:${range.start}:${range.end}`
      : `analytics:transfers:${range.start}:${range.end}`;
  }

  private isAnalyticsRangeDto(range: AnalyticsRangeInput): range is AnalyticsRangeDto {
    return 'startDate' in range || 'endDate' in range;
  }
}
