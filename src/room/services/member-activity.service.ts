import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { RoomMember } from '../entities/room-member.entity';
import { RedisService } from '../../redis/redis.service';
import {
  ROOM_MEMBER_CONSTANTS,
  ActivityType,
} from '../constants/room-member.constants';

interface ActivityRecord {
  userId: string;
  roomId: string;
  activityType: ActivityType;
  timestamp: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class MemberActivityService {
  constructor(
    @InjectRepository(RoomMember)
    private memberRepository: Repository<RoomMember>,
    private redisService: RedisService,
  ) {}

  async recordActivity(
    userId: string,
    roomId: string,
    activityType: ActivityType,
    metadata?: Record<string, any>,
  ): Promise<void> {
    // Update last activity timestamp in database
    const member = await this.memberRepository.findOne({
      where: { userId, roomId },
    });

    if (member) {
      member.lastActivityAt = new Date();
      await this.memberRepository.save(member);
    }

    // Store activity in Redis for recent activities
    const activityKey = `activity:${roomId}:${userId}`;
    const activity: ActivityRecord = {
      userId,
      roomId,
      activityType,
      timestamp: new Date(),
      metadata,
    };

    await this.redisService.lpush(
      activityKey,
      JSON.stringify(activity),
    );

    // Keep only last 100 activities per user per room
    await this.redisService.ltrim(activityKey, 0, 99);
    await this.redisService.expire(activityKey, 30 * 24 * 60 * 60); // 30 days

    // Store in global activity feed
    const feedKey = `activity:feed:${roomId}`;
    await this.redisService.lpush(feedKey, JSON.stringify(activity));
    await this.redisService.ltrim(feedKey, 0, 999);
    await this.redisService.expire(feedKey, 7 * 24 * 60 * 60); // 7 days
  }

  async getLastActivity(userId: string, roomId: string): Promise<Date | null> {
    const member = await this.memberRepository.findOne({
      where: { userId, roomId },
    });

    if (!member) {
      return null;
    }

    return member.lastActivityAt;
  }

  async getActivityHistory(
    userId: string,
    roomId: string,
    limit: number = 50,
  ): Promise<ActivityRecord[]> {
    const activityKey = `activity:${roomId}:${userId}`;
    const activities = await this.redisService.lrange(activityKey, 0, limit - 1);

    if (!activities || activities.length === 0) {
      return [];
    }

    return activities.map((activity) => JSON.parse(activity));
  }

  async getRoomActivityFeed(
    roomId: string,
    limit: number = 100,
  ): Promise<ActivityRecord[]> {
    const feedKey = `activity:feed:${roomId}`;
    const activities = await this.redisService.lrange(feedKey, 0, limit - 1);

    if (!activities || activities.length === 0) {
      return [];
    }

    return activities.map((activity) => JSON.parse(activity));
  }

  async getActivityStats(
    roomId: string,
    userId: string,
  ): Promise<{
    lastActive: Date | null;
    totalActivities: number;
    activitiesByType: Record<ActivityType, number>;
  }> {
    const lastActive = await this.getLastActivity(userId, roomId);
    const activities = await this.getActivityHistory(userId, roomId, 1000);

    const activitiesByType: Record<ActivityType, number> = {} as any;
    for (const type of Object.values(ActivityType)) {
      activitiesByType[type] = 0;
    }

    for (const activity of activities) {
      if (activitiesByType[activity.activityType] !== undefined) {
        activitiesByType[activity.activityType]++;
      }
    }

    return {
      lastActive,
      totalActivities: activities.length,
      activitiesByType,
    };
  }

  async getTopActiveUsers(
    roomId: string,
    limit: number = 10,
  ): Promise<Array<{ userId: string; activityCount: number }>> {
    const members = await this.memberRepository.find({
      where: { roomId },
    });

    const activityCounts: Record<string, number> = {};

    for (const member of members) {
      const activities = await this.getActivityHistory(member.userId, roomId, 1000);
      activityCounts[member.userId] = activities.length;
    }

    return Object.entries(activityCounts)
      .map(([userId, count]) => ({ userId, activityCount: count }))
      .sort((a, b) => b.activityCount - a.activityCount)
      .slice(0, limit);
  }

  async getMostActiveHours(
    roomId: string,
  ): Promise<Record<number, number>> {
    const feedKey = `activity:feed:${roomId}`;
    const activities = await this.redisService.lrange(feedKey, 0, -1);

    if (!activities || activities.length === 0) {
      return {};
    }

    const hourCounts: Record<number, number> = {};

    for (const activityStr of activities) {
      try {
        const activity = JSON.parse(activityStr);
        const hour = new Date(activity.timestamp).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      } catch (e) {
        // Skip malformed entries
      }
    }

    return hourCounts;
  }

  async cleanOldActivities(roomId: string, daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Clean member activity records in database
    const members = await this.memberRepository.find({
      where: { roomId },
    });

    let count = 0;
    for (const member of members) {
      const activities = await this.getActivityHistory(member.userId, roomId, 10000);
      const recentActivities = activities.filter(
        (a) => new Date(a.timestamp) > cutoffDate,
      );

      if (recentActivities.length < activities.length) {
        const activityKey = `activity:${roomId}:${member.userId}`;
        // Delete and recreate with only recent activities
        await this.redisService.delete(activityKey);
        for (const activity of recentActivities) {
          await this.redisService.lpush(
            activityKey,
            JSON.stringify(activity),
          );
        }
        count++;
      }
    }

    return count;
  }

  async getMemberOnlineStatus(
    roomId: string,
    userId: string,
  ): Promise<{
    isOnline: boolean;
    lastSeen: Date | null;
    minutesSinceLastActivity: number | null;
  }> {
    const lastActive = await this.getLastActivity(userId, roomId);

    if (!lastActive) {
      return {
        isOnline: false,
        lastSeen: null,
        minutesSinceLastActivity: null,
      };
    }

    const now = new Date();
    const minutesSinceLastActivity = Math.floor(
      (now.getTime() - lastActive.getTime()) / (1000 * 60),
    );

    // Consider online if active in last 5 minutes
    const isOnline = minutesSinceLastActivity < 5;

    return {
      isOnline,
      lastSeen: lastActive,
      minutesSinceLastActivity,
    };
  }

  async bulkGetOnlineStatus(
    roomId: string,
    userIds: string[],
  ): Promise<Record<string, { isOnline: boolean; minutesSinceLastActivity: number | null }>> {
    const result: Record<string, { isOnline: boolean; minutesSinceLastActivity: number | null }> = {};

    for (const userId of userIds) {
      const status = await this.getMemberOnlineStatus(roomId, userId);
      result[userId] = {
        isOnline: status.isOnline,
        minutesSinceLastActivity: status.minutesSinceLastActivity,
      };
    }

    return result;
  }
}
