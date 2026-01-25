import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { Streak } from '../entities/streak.entity';
import { StreakReward, StreakRewardType } from '../entities/streak-reward.entity';
import { StreakBadge, BadgeType } from '../entities/streak-badge.entity';
import { StreakHistory, StreakAction } from '../entities/streak-history.entity';
import { User } from '../entities/user.entity';
import { QueueService } from '../../queue/queue.service';
import { XpService } from './xp.service';
import { XpAction } from '../constants/xp-actions.constants';

// Streak milestones for rewards
export const STREAK_MILESTONES = [3, 7, 14, 30];
export const GRACE_PERIOD_HOURS = 6;
export const FREEZE_ITEM_DURATION_HOURS = 24;

// Reward configurations
const REWARD_CONFIG: Record<number, { xp: number; description: string }> = {
  3: { xp: 50, description: '3 Day Streak Reward' },
  7: { xp: 150, description: '7 Day Streak Reward' },
  14: { xp: 350, description: '14 Day Streak Reward' },
  30: { xp: 1000, description: '30 Day Streak Reward' },
};

// Badge configurations
const BADGE_CONFIG: Record<number, BadgeType> = {
  3: BadgeType.STREAK_3,
  7: BadgeType.STREAK_7,
  14: BadgeType.STREAK_14,
  30: BadgeType.STREAK_30,
  60: BadgeType.STREAK_60,
  100: BadgeType.STREAK_100,
  365: BadgeType.STREAK_365,
};

@Injectable()
export class StreakService {
  constructor(
    @InjectRepository(Streak)
    private readonly streakRepository: Repository<Streak>,
    @InjectRepository(StreakReward)
    private readonly streakRewardRepository: Repository<StreakReward>,
    @InjectRepository(StreakBadge)
    private readonly streakBadgeRepository: Repository<StreakBadge>,
    @InjectRepository(StreakHistory)
    private readonly streakHistoryRepository: Repository<StreakHistory>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly queueService: QueueService,
    private readonly xpService: XpService,
  ) {}

  /**
   * Get or create streak for a user
   */
  async getOrCreateStreak(userId: string): Promise<Streak> {
    let streak = await this.streakRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!streak) {
      streak = this.streakRepository.create({
        userId,
        currentStreak: 0,
        longestStreak: 0,
        lastLoginDate: null,
        freezeItems: 0,
        gracePeriodEnd: null,
        streakMultiplier: 1.0,
        totalDaysLogged: 0,
      });
      streak = await this.streakRepository.save(streak);
    }

    return streak;
  }

  /**
   * Track daily login and update streak
   */
  async trackDailyLogin(userId: string): Promise<{
    streak: Streak;
    incremented: boolean;
    reset: boolean;
    rewardClaimed: boolean;
    milestone?: number;
  }> {
    const streak = await this.getOrCreateStreak(userId);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const lastLoginDate = streak.lastLoginDate
      ? new Date(streak.lastLoginDate)
      : null;
    if (lastLoginDate) {
      lastLoginDate.setUTCHours(0, 0, 0, 0);
    }

    // Check if already logged in today
    if (lastLoginDate && lastLoginDate.getTime() === today.getTime()) {
      return {
        streak,
        incremented: false,
        reset: false,
        rewardClaimed: false,
      };
    }

    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    let incremented = false;
    let reset = false;
    let rewardClaimed = false;
    let milestone: number | undefined;

    // Check if this is a consecutive day
    if (
      lastLoginDate &&
      lastLoginDate.getTime() === yesterday.getTime()
    ) {
      // Consecutive day - increment streak
      streak.currentStreak += 1;
      incremented = true;

      // Update longest streak if needed
      if (streak.currentStreak > streak.longestStreak) {
        streak.longestStreak = streak.currentStreak;
      }

      // Check for milestone rewards
      if (STREAK_MILESTONES.includes(streak.currentStreak)) {
        milestone = streak.currentStreak;
        await this.claimMilestoneReward(userId, streak.currentStreak);
        rewardClaimed = true;
      }

      // Check for badge eligibility
      await this.checkAndAwardBadges(userId, streak.currentStreak, streak.longestStreak);

      // Update streak multiplier based on current streak
      streak.streakMultiplier = this.calculateStreakMultiplier(streak.currentStreak);
    } else if (
      lastLoginDate &&
      lastLoginDate.getTime() < yesterday.getTime()
    ) {
      // Missed day(s) - check grace period or freeze
      const canRecover = await this.checkGracePeriodOrFreeze(streak, lastLoginDate);

      if (canRecover) {
        // Recovered using grace period or freeze
        streak.currentStreak += 1;
        incremented = true;

        if (streak.currentStreak > streak.longestStreak) {
          streak.longestStreak = streak.currentStreak;
        }

        if (STREAK_MILESTONES.includes(streak.currentStreak)) {
          milestone = streak.currentStreak;
          await this.claimMilestoneReward(userId, streak.currentStreak);
          rewardClaimed = true;
        }

        await this.checkAndAwardBadges(userId, streak.currentStreak, streak.longestStreak);
        streak.streakMultiplier = this.calculateStreakMultiplier(streak.currentStreak);
      } else {
        // Reset streak
        await this.resetStreak(userId, streak);
        reset = true;
      }
    } else {
      // First login or first login after a long time
      streak.currentStreak = 1;
      incremented = true;

      if (streak.longestStreak < 1) {
        streak.longestStreak = 1;
      }

      streak.streakMultiplier = this.calculateStreakMultiplier(1);
    }

    // Update last login date and total days logged
    streak.lastLoginDate = today;
    streak.totalDaysLogged += 1;
    streak.gracePeriodEnd = null; // Reset grace period after successful login

    await this.streakRepository.save(streak);

    // Log history
    await this.logStreakHistory(
      userId,
      incremented ? StreakAction.INCREMENT : reset ? StreakAction.RESET : StreakAction.LOGIN,
      reset ? 0 : streak.currentStreak - (incremented ? 1 : 0),
      streak.currentStreak,
      incremented
        ? `Streak incremented to ${streak.currentStreak}`
        : reset
        ? 'Streak reset due to missed day'
        : 'Daily login tracked',
    );

    // Send notification if needed
    if (incremented && streak.currentStreak > 1) {
      await this.queueService.addNotificationJob({
        type: 'STREAK_INCREMENT',
        userId,
        currentStreak: streak.currentStreak,
        message: `🔥 Your streak is now ${streak.currentStreak} days! Keep it going!`,
      });
    }

    if (reset) {
      await this.queueService.addNotificationJob({
        type: 'STREAK_RESET',
        userId,
        message: 'Your streak has been reset. Start a new one today!',
      });
    }

    return {
      streak,
      incremented,
      reset,
      rewardClaimed,
      milestone,
    };
  }

  /**
   * Check if user can recover streak using grace period or freeze
   */
  private async checkGracePeriodOrFreeze(
    streak: Streak,
    lastLoginDate: Date,
  ): Promise<boolean> {
    const now = new Date();
    const lastLogin = new Date(lastLoginDate);
    
    // Calculate the grace period end: 6 hours after midnight of the day after last login
    const gracePeriodEnd = new Date(lastLogin);
    gracePeriodEnd.setUTCDate(gracePeriodEnd.getUTCDate() + 1);
    gracePeriodEnd.setUTCHours(GRACE_PERIOD_HOURS, 0, 0, 0);

    // Check if we're within the grace period (before 6 AM on the day after last login)
    if (now <= gracePeriodEnd) {
      // Within grace period
      streak.gracePeriodEnd = gracePeriodEnd;
      await this.logStreakHistory(
        streak.userId,
        StreakAction.GRACE_PERIOD_USED,
        streak.currentStreak,
        streak.currentStreak,
        'Grace period used to maintain streak',
      );
      return true;
    }

    // Check if user has freeze items
    if (streak.freezeItems > 0) {
      streak.freezeItems -= 1;
      await this.logStreakHistory(
        streak.userId,
        StreakAction.FREEZE_USED,
        streak.currentStreak,
        streak.currentStreak,
        'Freeze item used to maintain streak',
      );
      return true;
    }

    return false;
  }

  /**
   * Reset streak
   */
  private async resetStreak(userId: string, streak: Streak): Promise<void> {
    const oldStreak = streak.currentStreak;
    streak.currentStreak = 0;
    streak.gracePeriodEnd = null;
    await this.streakRepository.save(streak);

    await this.logStreakHistory(
      userId,
      StreakAction.RESET,
      oldStreak,
      0,
      `Streak reset from ${oldStreak} days`,
    );
  }

  /**
   * Claim milestone reward
   */
  private async claimMilestoneReward(userId: string, milestone: number): Promise<void> {
    // Check if already claimed
    const existing = await this.streakRewardRepository.findOne({
      where: { userId, milestone, claimedAt: MoreThan(new Date(0)) },
    });

    if (existing) {
      return; // Already claimed
    }

    const rewardConfig = REWARD_CONFIG[milestone];
    if (!rewardConfig) {
      return;
    }

    // Create reward record
    const reward = this.streakRewardRepository.create({
      userId,
      milestone,
      rewardType: StreakRewardType.XP,
      rewardAmount: rewardConfig.xp,
      rewardDescription: rewardConfig.description,
      claimedAt: new Date(),
    });

    await this.streakRewardRepository.save(reward);

    // Award XP
    await this.xpService.addXp(
      userId,
      XpAction.DAILY_LOGIN,
      rewardConfig.description,
    );

    // Log history
    await this.logStreakHistory(
      userId,
      StreakAction.REWARD_CLAIMED,
      null,
      null,
      `Claimed ${milestone}-day streak reward: ${rewardConfig.xp} XP`,
    );

    // Send notification
    await this.queueService.addNotificationJob({
      type: 'STREAK_REWARD',
      userId,
      milestone,
      rewardAmount: rewardConfig.xp,
      message: `🎉 Congratulations! You've reached a ${milestone}-day streak and earned ${rewardConfig.xp} XP!`,
    });
  }

  /**
   * Check and award badges
   */
  private async checkAndAwardBadges(
    userId: string,
    currentStreak: number,
    longestStreak: number,
  ): Promise<void> {
    // Check current streak badges
    for (const [days, badgeType] of Object.entries(BADGE_CONFIG)) {
      const dayCount = parseInt(days);
      if (currentStreak >= dayCount) {
        const existing = await this.streakBadgeRepository.findOne({
          where: { userId, badgeType },
        });

        if (!existing) {
          const badge = this.streakBadgeRepository.create({
            userId,
            badgeType,
            description: `Achieved ${dayCount}-day streak`,
          });
          await this.streakBadgeRepository.save(badge);

          await this.queueService.addNotificationJob({
            type: 'STREAK_BADGE',
            userId,
            badgeType,
            message: `🏆 New badge unlocked: ${dayCount}-day streak!`,
          });
        }
      }
    }

    // Check longest streak badges
    if (longestStreak >= 10) {
      const badgeType = longestStreak >= 100
        ? BadgeType.LONGEST_STREAK_100
        : longestStreak >= 30
        ? BadgeType.LONGEST_STREAK_30
        : BadgeType.LONGEST_STREAK_10;

      const existing = await this.streakBadgeRepository.findOne({
        where: { userId, badgeType },
      });

      if (!existing) {
        const badge = this.streakBadgeRepository.create({
          userId,
          badgeType,
          description: `Longest streak: ${longestStreak} days`,
        });
        await this.streakBadgeRepository.save(badge);
      }
    }
  }

  /**
   * Calculate streak multiplier based on current streak
   */
  private calculateStreakMultiplier(streak: number): number {
    if (streak >= 30) return 2.0;
    if (streak >= 14) return 1.5;
    if (streak >= 7) return 1.25;
    if (streak >= 3) return 1.1;
    return 1.0;
  }

  /**
   * Log streak history
   */
  private async logStreakHistory(
    userId: string,
    action: StreakAction,
    streakBefore: number | null,
    streakAfter: number | null,
    description: string | null,
  ): Promise<void> {
    const history = this.streakHistoryRepository.create({
      userId,
      action,
      streakBefore,
      streakAfter,
      description,
    });
    await this.streakHistoryRepository.save(history);
  }

  /**
   * Get user streak information
   */
  async getUserStreak(userId: string): Promise<{
    streak: Streak;
    nextMilestone: number | null;
    daysUntilNextMilestone: number | null;
    canUseFreeze: boolean;
    canUseGracePeriod: boolean;
    badges: StreakBadge[];
    recentRewards: StreakReward[];
  }> {
    const streak = await this.getOrCreateStreak(userId);

    // Find next milestone
    const nextMilestone = STREAK_MILESTONES.find(
      (milestone) => milestone > streak.currentStreak,
    ) || null;

    const daysUntilNextMilestone = nextMilestone
      ? nextMilestone - streak.currentStreak
      : null;

    // Check if can use freeze
    const canUseFreeze = streak.freezeItems > 0;

    // Check if can use grace period
    const now = new Date();
    const canUseGracePeriod =
      streak.gracePeriodEnd !== null && now <= streak.gracePeriodEnd;

    // Get badges
    const badges = await this.streakBadgeRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    // Get recent rewards
    const recentRewards = await this.streakRewardRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return {
      streak,
      nextMilestone,
      daysUntilNextMilestone,
      canUseFreeze,
      canUseGracePeriod,
      badges,
      recentRewards,
    };
  }

  /**
   * Add freeze items to user
   */
  async addFreezeItems(userId: string, amount: number): Promise<Streak> {
    const streak = await this.getOrCreateStreak(userId);
    streak.freezeItems += amount;
    return await this.streakRepository.save(streak);
  }

  /**
   * Use freeze item manually
   */
  async useFreezeItem(userId: string): Promise<Streak> {
    const streak = await this.getOrCreateStreak(userId);

    if (streak.freezeItems <= 0) {
      throw new BadRequestException('No freeze items available');
    }

    // Check if streak needs to be maintained
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const lastLoginDate = streak.lastLoginDate
      ? new Date(streak.lastLoginDate)
      : null;
    if (lastLoginDate) {
      lastLoginDate.setUTCHours(0, 0, 0, 0);
    }

    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    if (
      lastLoginDate &&
      lastLoginDate.getTime() < yesterday.getTime() &&
      streak.currentStreak > 0
    ) {
      // Can use freeze to maintain streak
      streak.freezeItems -= 1;
      await this.logStreakHistory(
        userId,
        StreakAction.FREEZE_USED,
        streak.currentStreak,
        streak.currentStreak,
        'Freeze item used manually to maintain streak',
      );
    } else {
      throw new BadRequestException('Freeze item cannot be used at this time');
    }

    return await this.streakRepository.save(streak);
  }

  /**
   * Get streak leaderboard
   */
  async getStreakLeaderboard(
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    users: Array<{
      userId: string;
      username: string;
      displayName: string;
      avatarUrl: string;
      currentStreak: number;
      longestStreak: number;
      rank: number;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;

    const [streaks, total] = await this.streakRepository.findAndCount({
      relations: ['user'],
      order: {
        currentStreak: 'DESC',
        longestStreak: 'DESC',
      },
      skip,
      take: limit,
    });

    const leaderboard = streaks.map((streak, index) => ({
      userId: streak.userId,
      username: streak.user.username,
      displayName: streak.user.displayName,
      avatarUrl: streak.user.avatarUrl,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      rank: skip + index + 1,
    }));

    return {
      users: leaderboard,
      total,
      page,
      limit,
    };
  }

  /**
   * Get streak analytics
   */
  async getStreakAnalytics(): Promise<{
    totalUsersWithStreaks: number;
    averageCurrentStreak: number;
    averageLongestStreak: number;
    totalFreezeItemsUsed: number;
    totalRewardsClaimed: number;
    usersByStreakRange: Array<{ range: string; count: number }>;
  }> {
    const allStreaks = await this.streakRepository.find();

    const totalUsersWithStreaks = allStreaks.length;
    const averageCurrentStreak =
      totalUsersWithStreaks > 0
        ? allStreaks.reduce((sum, s) => sum + s.currentStreak, 0) / totalUsersWithStreaks
        : 0;
    const averageLongestStreak =
      totalUsersWithStreaks > 0
        ? allStreaks.reduce((sum, s) => sum + s.longestStreak, 0) / totalUsersWithStreaks
        : 0;

    // Count freeze items used (total freeze items - current freeze items)
    const totalFreezeItemsUsed = allStreaks.reduce(
      (sum, s) => sum + Math.max(0, s.totalDaysLogged - s.currentStreak),
      0,
    );

    const totalRewardsClaimed = await this.streakRewardRepository.count({
      where: { claimedAt: MoreThan(new Date(0)) },
    });

    // Users by streak range
    const ranges = [
      { min: 0, max: 2, label: '0-2 days' },
      { min: 3, max: 6, label: '3-6 days' },
      { min: 7, max: 13, label: '7-13 days' },
      { min: 14, max: 29, label: '14-29 days' },
      { min: 30, max: 59, label: '30-59 days' },
      { min: 60, max: 99, label: '60-99 days' },
      { min: 100, max: Infinity, label: '100+ days' },
    ];

    const usersByStreakRange = ranges.map((range) => ({
      range: range.label,
      count: allStreaks.filter(
        (s) => s.currentStreak >= range.min && s.currentStreak <= range.max,
      ).length,
    }));

    return {
      totalUsersWithStreaks,
      averageCurrentStreak: Math.round(averageCurrentStreak * 100) / 100,
      averageLongestStreak: Math.round(averageLongestStreak * 100) / 100,
      totalFreezeItemsUsed,
      totalRewardsClaimed,
      usersByStreakRange,
    };
  }

  /**
   * Get streak history for a user
   */
  async getStreakHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    history: StreakHistory[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;

    const [history, total] = await this.streakHistoryRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      history,
      total,
      page,
      limit,
    };
  }
}
