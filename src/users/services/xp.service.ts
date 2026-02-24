import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import { User } from '../entities/user.entity';
import { XpHistory } from '../entities/xp-history.entity';
import {
  XpAction,
  XP_VALUES,
  XP_PER_LEVEL,
  DAILY_XP_CAP_REGULAR,
  DAILY_XP_CAP_PREMIUM,
  PREMIUM_XP_MULTIPLIER,
} from '../constants/xp-actions.constants';
import { QueueService } from '../../queue/queue.service';
import { AdminService } from '../../admin/services/admin.service';
import { LeaderboardService } from '../../leaderboard/leaderboard.service';
import { LeaderboardCategory } from '../../leaderboard/leaderboard.interface';

@Injectable()
export class XpService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(XpHistory)
    private readonly xpHistoryRepository: Repository<XpHistory>,
    private readonly queueService: QueueService,
    private readonly adminService: AdminService,
    private readonly leaderboardService: LeaderboardService,
  ) {}

  async addXp(
    userId: string,
    action: XpAction,
    description?: string,
  ): Promise<{ user: User; leveledUp: boolean; levelsGained: number }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const hasReachedDailyCap = await this.checkDailyCap(userId, user.isPremium);
    if (hasReachedDailyCap) {
      return { user, leveledUp: false, levelsGained: 0 };
    }

    const globalXpMultiplier = await this.adminService.getConfigValue<number>(
      'xp_multiplier',
      1.0,
    );

    const baseXp = XP_VALUES[action];
    const userMultiplier = user.isPremium
      ? user.xpMultiplier || PREMIUM_XP_MULTIPLIER
      : 1.0;
    const xpToAdd = Math.floor(baseXp * userMultiplier * globalXpMultiplier);

    const oldLevel = user.level;
    const oldXp = user.currentXp;

    user.currentXp += xpToAdd;

    const newLevel = this.calculateLevel(user.currentXp);
    const levelsGained = newLevel - oldLevel;
    const leveledUp = levelsGained > 0;

    user.level = newLevel;

    await this.userRepository.save(user);

    // Update Leaderboard
    await this.leaderboardService.updateLeaderboard({
      userId: user.id,
      username: user.username,
      category: LeaderboardCategory.XP,
      scoreIncrement: xpToAdd,
    });

    await this.xpHistoryRepository.save({
      userId: user.id,
      amount: xpToAdd,
      action,
      description: description || `Earned ${xpToAdd} XP for ${action}`,
      levelBefore: oldLevel,
      levelAfter: newLevel,
    });

    if (leveledUp) {
      await this.queueService.addNotificationJob({
        type: 'LEVEL_UP',
        userId: user.id,
        username: user.username,
        oldLevel,
        newLevel,
        currentXp: user.currentXp,
      });
    }

    return { user, leveledUp, levelsGained };
  }

  calculateLevel(totalXp: number): number {
    return Math.floor(totalXp / XP_PER_LEVEL) + 1;
  }

  getXpForNextLevel(currentXp: number): number {
    const currentLevel = this.calculateLevel(currentXp);
    const xpForNextLevel = currentLevel * XP_PER_LEVEL;
    return xpForNextLevel - currentXp;
  }

  async checkDailyCap(userId: string, isPremium: boolean): Promise<boolean> {
    if (isPremium) {
      return false;
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const dailyXp = await this.xpHistoryRepository
      .createQueryBuilder('xp')
      .select('SUM(xp.amount)', 'total')
      .where('xp.userId = :userId', { userId })
      .andWhere('xp.createdAt >= :today', { today })
      .andWhere('xp.createdAt < :tomorrow', { tomorrow })
      .getRawOne();

    const totalToday = parseInt(dailyXp?.total || '0');
    return totalToday >= DAILY_XP_CAP_REGULAR;
  }

  async getUserXpStats(userId: string): Promise<{
    currentXp: number;
    level: number;
    xpForNextLevel: number;
    totalXpEarned: number;
    dailyXpEarned: number;
    dailyCapReached: boolean;
    rank: number;
  }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const totalXpResult = await this.xpHistoryRepository
      .createQueryBuilder('xp')
      .select('SUM(xp.amount)', 'total')
      .where('xp.userId = :userId', { userId })
      .getRawOne();

    const dailyXpResult = await this.xpHistoryRepository
      .createQueryBuilder('xp')
      .select('SUM(xp.amount)', 'total')
      .where('xp.userId = :userId', { userId })
      .andWhere('xp.createdAt >= :today', { today })
      .andWhere('xp.createdAt < :tomorrow', { tomorrow })
      .getRawOne();

    const totalXpEarned = parseInt(totalXpResult?.total || '0');
    const dailyXpEarned = parseInt(dailyXpResult?.total || '0');

    const dailyCapReached = await this.checkDailyCap(userId, user.isPremium);

    const rank = await this.getUserRank(userId);

    return {
      currentXp: user.currentXp,
      level: user.level,
      xpForNextLevel: this.getXpForNextLevel(user.currentXp),
      totalXpEarned,
      dailyXpEarned,
      dailyCapReached,
      rank,
    };
  }

  async getLeaderboard(
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    users: Array<{
      userId: string;
      username: string;
      displayName: string;
      avatarUrl: string;
      level: number;
      currentXp: number;
      rank: number;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;

    const [users, total] = await this.userRepository.findAndCount({
      select: [
        'id',
        'username',
        'displayName',
        'avatarUrl',
        'level',
        'currentXp',
      ],
      order: {
        level: 'DESC',
        currentXp: 'DESC',
      },
      skip,
      take: limit,
    });

    const leaderboard = users.map((user, index) => ({
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      level: user.level,
      currentXp: user.currentXp,
      rank: skip + index + 1,
    }));

    return {
      users: leaderboard,
      total,
      page,
      limit,
    };
  }

  async getUserRank(userId: string): Promise<number> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const rank = await this.userRepository
      .createQueryBuilder('user')
      .where(
        '(user.level > :level) OR (user.level = :level AND user.currentXp > :currentXp)',
        { level: user.level, currentXp: user.currentXp },
      )
      .getCount();

    return rank + 1;
  }

  async getXpHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    history: XpHistory[];
    total: number;
    page: number;
    limit: number;
  }> {
    const skip = (page - 1) * limit;

    const [history, total] = await this.xpHistoryRepository.findAndCount({
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

  async getTotalXp(): Promise<number> {
    const result = await this.xpHistoryRepository
      .createQueryBuilder('xp')
      .select('SUM(xp.amount)', 'total')
      .getRawOne();

    return parseInt(result?.total || '0');
  }

  async getAverageXpPerUser(): Promise<number> {
    const totalXp = await this.getTotalXp();
    const userCount = await this.userRepository.count();

    if (userCount === 0) return 0;

    return Math.round(totalXp / userCount);
  }

  async getWeeklyXp(): Promise<{
    weeklyTotal: number;
    dailyBreakdown: Array<{ date: string; xp: number }>;
  }> {
    const today = new Date();
    today.setUTCHours(23, 59, 59, 999);
    const weekAgo = new Date(today);
    weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
    weekAgo.setUTCHours(0, 0, 0, 0);

    const weeklyResult = await this.xpHistoryRepository
      .createQueryBuilder('xp')
      .select('SUM(xp.amount)', 'total')
      .where('xp.createdAt >= :weekAgo', { weekAgo })
      .andWhere('xp.createdAt <= :today', { today })
      .getRawOne();

    const weeklyTotal = parseInt(weeklyResult?.total || '0');

    const dailyResults = await this.xpHistoryRepository
      .createQueryBuilder('xp')
      .select('DATE(xp.createdAt)', 'date')
      .addSelect('SUM(xp.amount)', 'xp')
      .where('xp.createdAt >= :weekAgo', { weekAgo })
      .andWhere('xp.createdAt <= :today', { today })
      .groupBy('DATE(xp.createdAt)')
      .orderBy('DATE(xp.createdAt)', 'ASC')
      .getRawMany();

    const dailyBreakdown = dailyResults.map((row) => ({
      date: row.date,
      xp: parseInt(row.xp || '0'),
    }));

    return {
      weeklyTotal,
      dailyBreakdown,
    };
  }

  async getXpByAction(userId?: string): Promise<
    Array<{
      action: XpAction;
      count: number;
      totalXp: number;
    }>
  > {
    const queryBuilder = this.xpHistoryRepository
      .createQueryBuilder('xp')
      .select('xp.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(xp.amount)', 'totalXp')
      .groupBy('xp.action')
      .orderBy('totalXp', 'DESC');

    if (userId) {
      queryBuilder.where('xp.userId = :userId', { userId });
    }

    const results = await queryBuilder.getRawMany();

    return results.map((row) => ({
      action: row.action as XpAction,
      count: parseInt(row.count || '0'),
      totalXp: parseInt(row.totalXp || '0'),
    }));
  }
}
