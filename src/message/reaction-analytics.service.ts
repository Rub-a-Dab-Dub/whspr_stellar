import { Injectable, Logger } from '@nestjs/common';
import { ReactionRepository } from './repositories/reaction.repository';
import { CacheService } from '../cache/cache.service';
import { RedisService } from '../redis/redis.service';

export interface ReactionAnalytics {
  messageId?: string;
  userId?: string;
  totalReactions: number;
  reactionsByType: {
    type: string;
    count: number;
    percentage: number;
  }[];
  topReaction: string | null;
  topReactionCount: number;
  timeRange?: {
    from: Date;
    to: Date;
  };
}

export interface PopularReactionsAnalytics {
  period: 'day' | 'week' | 'month' | 'all_time';
  totalReactions: number;
  topReactions: Array<{
    rank: number;
    emoji: string;
    count: number;
    percentage: number;
  }>;
  uniqueUsers: number;
}

@Injectable()
export class ReactionAnalyticsService {
  private readonly logger = new Logger(ReactionAnalyticsService.name);
  private readonly ANALYTICS_CACHE_PREFIX = 'analytics:reactions:';
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(
    private readonly reactionRepository: ReactionRepository,
    private readonly cacheService: CacheService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Get analytics for a specific message
   */
  async getMessageAnalytics(messageId: string): Promise<ReactionAnalytics> {
    const cacheKey = `${this.ANALYTICS_CACHE_PREFIX}message:${messageId}`;
    const cached = await this.cacheService.get<ReactionAnalytics>(cacheKey);

    if (cached) {
      return cached;
    }

    const reactions =
      await this.reactionRepository.getReactionCounts(messageId);
    const totalReactions = reactions.reduce((sum, r) => sum + r.count, 0);

    const reactionsByType = reactions.map((r) => ({
      type: r.type,
      count: r.count,
      percentage: totalReactions > 0 ? (r.count / totalReactions) * 100 : 0,
    }));

    const topReaction = reactions.length > 0 ? reactions[0].type : null;
    const topReactionCount = reactions.length > 0 ? reactions[0].count : 0;

    const analytics: ReactionAnalytics = {
      messageId,
      totalReactions,
      reactionsByType,
      topReaction,
      topReactionCount,
    };

    await this.cacheService.set(cacheKey, analytics, this.CACHE_TTL);
    return analytics;
  }

  /**
   * Get analytics for a user's reactions
   */
  async getUserReactionAnalytics(userId: string): Promise<ReactionAnalytics> {
    const cacheKey = `${this.ANALYTICS_CACHE_PREFIX}user:${userId}`;
    const cached = await this.cacheService.get<ReactionAnalytics>(cacheKey);

    if (cached) {
      return cached;
    }

    const reactions = await this.reactionRepository.find({
      where: { userId },
    });

    const totalReactions = reactions.length;

    const reactionCounts = reactions.reduce(
      (acc, reaction) => {
        const existing = acc.find((r) => r.type === reaction.type);
        if (existing) {
          existing.count++;
        } else {
          acc.push({ type: reaction.type, count: 1 });
        }
        return acc;
      },
      [] as Array<{ type: string; count: number }>,
    );

    const reactionsByType = reactionCounts
      .map((r) => ({
        type: r.type,
        count: r.count,
        percentage: totalReactions > 0 ? (r.count / totalReactions) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const topReaction =
      reactionsByType.length > 0 ? reactionsByType[0].type : null;
    const topReactionCount =
      reactionsByType.length > 0 ? reactionsByType[0].count : 0;

    const analytics: ReactionAnalytics = {
      userId,
      totalReactions,
      reactionsByType,
      topReaction,
      topReactionCount,
    };

    await this.cacheService.set(cacheKey, analytics, this.CACHE_TTL);
    return analytics;
  }

  /**
   * Get popular reactions with detailed analytics
   */
  async getPopularReactionsAnalytics(
    period: 'day' | 'week' | 'month' | 'all_time' = 'all_time',
  ): Promise<PopularReactionsAnalytics> {
    const cacheKey = `${this.ANALYTICS_CACHE_PREFIX}popular:${period}`;
    const cached =
      await this.cacheService.get<PopularReactionsAnalytics>(cacheKey);

    if (cached) {
      return cached;
    }

    const cutoffDate = this.getCutoffDate(period);
    let reactions = await this.reactionRepository.find({});

    // Filter by date if not all_time
    if (period !== 'all_time') {
      reactions = reactions.filter((r) => r.createdAt >= cutoffDate);
    }

    const totalReactions = reactions.length;

    const reactionCounts = reactions.reduce(
      (acc, reaction) => {
        const existing = acc.find((r) => r.type === reaction.type);
        if (existing) {
          existing.count++;
        } else {
          acc.push({ type: reaction.type, count: 1 });
        }
        return acc;
      },
      [] as Array<{ type: string; count: number }>,
    );

    const topReactions = reactionCounts
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((r, index) => ({
        rank: index + 1,
        emoji: r.type,
        count: r.count,
        percentage: totalReactions > 0 ? (r.count / totalReactions) * 100 : 0,
      }));

    const uniqueUsers = new Set(reactions.map((r) => r.userId)).size;

    const analytics: PopularReactionsAnalytics = {
      period,
      totalReactions,
      topReactions,
      uniqueUsers,
    };

    const ttl = period === 'day' ? 3600 : period === 'week' ? 21600 : 86400;
    await this.cacheService.set(cacheKey, analytics, ttl);

    return analytics;
  }

  /**
   * Get comparison of reactions across messages
   */
  async compareMessageReactions(
    messageIds: string[],
  ): Promise<Map<string, ReactionAnalytics>> {
    const result = new Map<string, ReactionAnalytics>();

    for (const messageId of messageIds) {
      const analytics = await this.getMessageAnalytics(messageId);
      result.set(messageId, analytics);
    }

    return result;
  }

  /**
   * Track reaction trend over time (returns data for charting)
   */
  async getReactionTrend(
    messageId: string,
    intervalHours: number = 24,
  ): Promise<
    Array<{
      timestamp: string;
      count: number;
      cumulativeCount: number;
    }>
  > {
    const reactions =
      await this.reactionRepository.findMessageReactions(messageId);

    const trends: Array<{
      timestamp: string;
      count: number;
      cumulativeCount: number;
    }> = [];

    let cumulativeCount = 0;
    const intervalMs = intervalHours * 60 * 60 * 1000;
    const now = new Date();

    // Group reactions by time interval
    const reactionsByInterval = new Map<number, number>();

    for (const reaction of reactions) {
      const intervalIndex = Math.floor(
        (now.getTime() - reaction.createdAt.getTime()) / intervalMs,
      );
      reactionsByInterval.set(
        intervalIndex,
        (reactionsByInterval.get(intervalIndex) ?? 0) + 1,
      );
    }

    // Build trend array
    const maxInterval = Math.max(...Array.from(reactionsByInterval.keys()), 0);
    for (let i = maxInterval; i >= 0; i--) {
      const count = reactionsByInterval.get(i) ?? 0;
      cumulativeCount += count;

      const timestamp = new Date(now.getTime() - i * intervalMs).toISOString();

      trends.push({
        timestamp,
        count,
        cumulativeCount,
      });
    }

    return trends.reverse();
  }

  /**
   * Get reaction heatmap data (distribution of reactions by hour)
   */
  async getReactionHeatmap(messageId: string): Promise<
    Array<{
      hour: number;
      type: string;
      count: number;
    }>
  > {
    const reactions =
      await this.reactionRepository.findMessageReactions(messageId);

    const heatmapData: Map<
      string,
      { hour: number; type: string; count: number }
    > = new Map();

    for (const reaction of reactions) {
      const hour = new Date(reaction.createdAt).getHours();
      const key = `${hour}-${reaction.type}`;

      const entry = heatmapData.get(key) || {
        hour,
        type: reaction.type,
        count: 0,
      };
      entry.count++;
      heatmapData.set(key, entry);
    }

    return Array.from(heatmapData.values()).sort((a, b) => a.hour - b.hour);
  }

  /**
   * Get reaction diversity score (how varied are the reactions)
   */
  async getReactionDiversity(messageId: string): Promise<number> {
    const reactions =
      await this.reactionRepository.getReactionCounts(messageId);

    if (reactions.length === 0) return 0;

    const totalReactions = reactions.reduce((sum, r) => sum + r.count, 0);
    const maxEntropy = Math.log(reactions.length);

    const entropy = reactions.reduce((sum, r) => {
      const p = r.count / totalReactions;
      return sum + -p * Math.log(p);
    }, 0);

    // Normalize to 0-100 scale
    const diversityScore = (entropy / maxEntropy) * 100;
    return Math.round(diversityScore);
  }

  /**
   * Export analytics as JSON
   */
  async exportAnalytics(messageId: string): Promise<string> {
    const messageAnalytics = await this.getMessageAnalytics(messageId);
    return JSON.stringify(messageAnalytics, null, 2);
  }

  /**
   * Helper method to get cutoff date based on period
   */
  private getCutoffDate(period: string): Date {
    const now = new Date();
    switch (period) {
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(0);
    }
  }
}
