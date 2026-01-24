// room-analytics.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RoomAnalytics } from './entities/room-analytics.entity';
import { RoomAnalyticsSummary } from './entities/room-analytics-summary';
import {
  AnalyticsDashboardDto,
  AnalyticsPeriod,
  GetAnalyticsDto,
} from './dto/room-analytics.dto';

@Injectable()
export class RoomAnalyticsService {
  constructor(
    @InjectRepository(RoomAnalytics)
    private analyticsRepo: Repository<RoomAnalytics>,
    @InjectRepository(RoomAnalyticsSummary)
    private summaryRepo: Repository<RoomAnalyticsSummary>,
  ) {}

  // Real-time tracking
  async trackMessage(roomId: string, userId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const hour = new Date().getHours();

    let analytics = await this.analyticsRepo.findOne({
      where: { room: { id: roomId }, date: today },
    });

    if (!analytics) {
      analytics = this.analyticsRepo.create({
        room: { id: roomId } as any,
        date: today,
        hourlyActivity: {},
        topContributors: [],
      });
    }

    // Increment message count
    analytics.totalMessages++;

    // Update hourly activity
    const hourKey = hour.toString();
    analytics.hourlyActivity[hourKey] =
      (analytics.hourlyActivity[hourKey] || 0) + 1;

    // Update top contributors
    let contributor = analytics.topContributors.find(
      (c) => c.userId === userId,
    );
    if (contributor) {
      contributor.messageCount++;
    } else {
      analytics.topContributors.push({ userId, messageCount: 1 });
    }

    // Sort and keep top 10
    analytics.topContributors.sort((a, b) => b.messageCount - a.messageCount);
    analytics.topContributors = analytics.topContributors.slice(0, 10);

    await this.analyticsRepo.save(analytics);

    // Update summary
    await this.updateSummary(roomId);
  }

  async trackNewMember(roomId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let analytics = await this.analyticsRepo.findOne({
      where: { room: { id: roomId }, date: today },
    });

    if (!analytics) {
      analytics = this.analyticsRepo.create({
        room: { id: roomId } as any,
        date: today,
        hourlyActivity: {},
        topContributors: [],
      });
    }

    analytics.newMembers++;
    await this.analyticsRepo.save(analytics);
  }

  private async updateSummary(roomId: string): Promise<void> {
    let summary = await this.summaryRepo.findOne({
      where: { room: { id: roomId } },
    });

    if (!summary) {
      summary = this.summaryRepo.create({
        room: { id: roomId } as any,
      });
    }

    // Get today's data
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayAnalytics = await this.analyticsRepo.findOne({
      where: { room: { id: roomId }, date: today },
    });

    // Get this week's data
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weekData = await this.analyticsRepo.find({
      where: {
        room: { id: roomId },
        date: MoreThanOrEqual(weekAgo),
      },
    });

    // Calculate metrics
    const allTimeData = await this.analyticsRepo.find({
      where: { room: { id: roomId } },
    });

    summary.totalMessagesAllTime = allTimeData.reduce(
      (sum, d) => sum + d.totalMessages,
      0,
    );
    summary.activeToda = todayAnalytics?.uniqueActiveMembers || 0;

    const activeUsersThisWeek = new Set();
    weekData.forEach((day) => {
      day.topContributors.forEach((c) => activeUsersThisWeek.add(c.userId));
    });
    summary.activeThisWeek = activeUsersThisWeek.size;

    // Calculate engagement score (0-100)
    summary.engagementScore = await this.calculateEngagementScore(
      roomId,
      weekData,
    );

    // Calculate growth rate
    summary.growthRate = await this.calculateGrowthRate(roomId, weekData);

    // Find peak hour
    const allHourlyData: Record<string, number> = {};
    allTimeData.forEach((day) => {
      Object.entries(day.hourlyActivity).forEach(([hour, count]) => {
        allHourlyData[hour] = (allHourlyData[hour] || 0) + count;
      });
    });

    summary.peakHour = parseInt(
      Object.entries(allHourlyData).sort(([, a], [, b]) => b - a)[0]?.[0] ||
        '12',
    );

    await this.summaryRepo.save(summary);
  }

  private async calculateEngagementScore(
    roomId: string,
    weekData: RoomAnalytics[],
  ): Promise<number> {
    if (weekData.length === 0) return 0;

    const totalMessages = weekData.reduce((sum, d) => sum + d.totalMessages, 0);
    const avgMessagesPerDay = totalMessages / 7;

    const activeUsers = new Set();
    weekData.forEach((day) => {
      day.topContributors.forEach((c) => activeUsers.add(c.userId));
    });

    // Score based on messages per day and user diversity
    const messageScore = Math.min((avgMessagesPerDay / 100) * 50, 50);
    const userScore = Math.min((activeUsers.size / 10) * 50, 50);

    return parseFloat((messageScore + userScore).toFixed(2));
  }

  private async calculateGrowthRate(
    roomId: string,
    weekData: RoomAnalytics[],
  ): Promise<number> {
    if (weekData.length < 7) return 0;

    const thisWeekMembers = weekData.reduce((sum, d) => sum + d.newMembers, 0);

    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const lastWeekData = await this.analyticsRepo.find({
      where: {
        room: { id: roomId },
        date: Between(twoWeeksAgo, oneWeekAgo),
      },
    });

    const lastWeekMembers = lastWeekData.reduce(
      (sum, d) => sum + d.newMembers,
      0,
    );

    if (lastWeekMembers === 0) return thisWeekMembers > 0 ? 100 : 0;

    const growth =
      ((thisWeekMembers - lastWeekMembers) / lastWeekMembers) * 100;
    return parseFloat(growth.toFixed(2));
  }

  async getDashboard(roomId: string): Promise<AnalyticsDashboardDto> {
    const summary = await this.summaryRepo.findOne({
      where: { room: { id: roomId } },
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const monthData = await this.analyticsRepo.find({
      where: {
        room: { id: roomId },
        date: MoreThanOrEqual(thirtyDaysAgo),
      },
      order: { date: 'ASC' },
    });

    // Get top contributors with usernames (you'll need to join with User entity)
    const topContributors = monthData
      .flatMap((d) => d.topContributors)
      .reduce((acc, curr) => {
        const existing = acc.find((c) => c.userId === curr.userId);
        if (existing) {
          existing.messageCount += curr.messageCount;
        } else {
          acc.push({ ...curr, username: curr.userId }); // TODO: fetch actual username
        }
        return acc;
      }, [] as any[])
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, 10);

    // Aggregate hourly activity
    const hourlyActivity: Record<string, number> = {};
    monthData.forEach((day) => {
      Object.entries(day.hourlyActivity).forEach(([hour, count]) => {
        hourlyActivity[hour] = (hourlyActivity[hour] || 0) + count;
      });
    });

    // Calculate retention
    const retentionRate =
      monthData.length > 1
        ? monthData.reduce((sum, d) => sum + d.activeReturnMembers, 0) /
          monthData.length
        : 0;

    return {
      summary: {
        totalMessages: Number(summary?.totalMessagesAllTime || 0),
        totalMembers: summary?.totalMembers || 0,
        activeToday: summary?.activeToda || 0,
        activeThisWeek: summary?.activeThisWeek || 0,
        engagementScore: summary?.engagementScore || 0,
        growthRate: summary?.growthRate || 0,
        peakHour: summary?.peakHour || 12,
      },
      messageVolume: monthData.map((d) => ({
        date: d.date.toISOString().split('T')[0],
        count: d.totalMessages,
      })),
      topContributors,
      hourlyActivity,
      retentionRate: parseFloat(retentionRate.toFixed(2)),
    };
  }

  async getAnalytics(roomId: string, dto: GetAnalyticsDto) {
    const where: any = { room: { id: roomId } };

    if (dto.startDate && dto.endDate) {
      where.date = Between(new Date(dto.startDate), new Date(dto.endDate));
    } else if (dto.period) {
      const now = new Date();
      const startDate = new Date(now);

      switch (dto.period) {
        case AnalyticsPeriod.DAY:
          startDate.setDate(now.getDate() - 1);
          break;
        case AnalyticsPeriod.WEEK:
          startDate.setDate(now.getDate() - 7);
          break;
        case AnalyticsPeriod.MONTH:
          startDate.setMonth(now.getMonth() - 1);
          break;
        case AnalyticsPeriod.YEAR:
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      where.date = MoreThanOrEqual(startDate);
    }

    return this.analyticsRepo.find({
      where,
      order: { date: 'DESC' },
    });
  }

  async exportAnalytics(roomId: string, format: 'json' | 'csv' = 'json') {
    const analytics = await this.analyticsRepo.find({
      where: { room: { id: roomId } },
      order: { date: 'ASC' },
    });

    if (format === 'csv') {
      const headers =
        'Date,Total Messages,Unique Members,New Members,Peak Hour\n';
      const rows = analytics
        .map((a) => {
          const peakHour =
            Object.entries(a.hourlyActivity).sort(
              ([, a], [, b]) => b - a,
            )[0]?.[0] || 'N/A';
          return `${a.date.toISOString().split('T')[0]},${a.totalMessages},${a.uniqueActiveMembers},${a.newMembers},${peakHour}`;
        })
        .join('\n');

      return headers + rows;
    }

    return analytics;
  }

  // Daily aggregation job
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async aggregateDailyAnalytics() {
    // This would aggregate unique active members for yesterday
    // You'd query your messages table to count unique users per room
    console.log('Running daily analytics aggregation...');

    // Pseudo-code:
    // const yesterday = getYesterday();
    // const rooms = await getAllRooms();
    // for (const room of rooms) {
    //   const uniqueUsers = await countUniqueActiveUsers(room.id, yesterday);
    //   await updateAnalytics(room.id, yesterday, { uniqueActiveMembers: uniqueUsers });
    // }
  }
}
