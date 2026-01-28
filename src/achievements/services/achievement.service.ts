import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Achievement } from '../entities/achievement.entity';
import { UserAchievement } from '../entities/user-achievement.entity';
import {
  CreateAchievementDto,
  UpdateAchievementDto,
} from '../dto/achievement.dto';
import { AchievementCheckerService } from './achievement-checker.service';
import { AchievementNotificationService } from './achievement-notification.service';

@Injectable()
export class AchievementService {
  private readonly logger = new Logger(AchievementService.name);

  constructor(
    @InjectRepository(Achievement)
    private achievementRepository: Repository<Achievement>,
    @InjectRepository(UserAchievement)
    private userAchievementRepository: Repository<UserAchievement>,
    private achievementCheckerService: AchievementCheckerService,
    private notificationService: AchievementNotificationService,
  ) {}

  /**
   * Create a new achievement
   */
  async create(createDto: CreateAchievementDto): Promise<Achievement> {
    const achievement = this.achievementRepository.create(createDto);
    return this.achievementRepository.save(achievement);
  }

  /**
   * Get all achievements (public listing)
   */
  async findAll(includeHidden = false): Promise<Achievement[]> {
    const where: any = { isActive: true };

    if (!includeHidden) {
      where.isHidden = false;
    }

    return this.achievementRepository.find({
      where,
      order: { displayOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  /**
   * Get a single achievement by ID
   */
  async findOne(id: string): Promise<Achievement> {
    const achievement = await this.achievementRepository.findOne({
      where: { id },
    });

    if (!achievement) {
      throw new NotFoundException(`Achievement with ID ${id} not found`);
    }

    return achievement;
  }

  /**
   * Update an achievement
   */
  async update(
    id: string,
    updateDto: UpdateAchievementDto,
  ): Promise<Achievement> {
    const achievement = await this.findOne(id);
    Object.assign(achievement, updateDto);
    return this.achievementRepository.save(achievement);
  }

  /**
   * Delete an achievement
   */
  async remove(id: string): Promise<void> {
    const achievement = await this.findOne(id);
    await this.achievementRepository.remove(achievement);
  }

  /**
   * Get user's achievements
   */
  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    return this.userAchievementRepository.find({
      where: { userId },
      relations: ['achievement'],
      order: { unlockedAt: 'DESC', createdAt: 'DESC' },
    });
  }

  /**
   * Get user's unlocked achievements only
   */
  async getUserUnlockedAchievements(
    userId: string,
  ): Promise<UserAchievement[]> {
    return this.userAchievementRepository.find({
      where: { userId, isUnlocked: true },
      relations: ['achievement'],
      order: { unlockedAt: 'DESC' },
    });
  }

  /**
   * Get user's achievement progress
   */
  async getUserAchievementProgress(userId: string): Promise<UserAchievement[]> {
    // Get all active achievements
    const allAchievements = await this.achievementRepository.find({
      where: { isActive: true, isHidden: false },
    });

    // Get user's achievement records
    const userAchievements = await this.userAchievementRepository.find({
      where: { userId },
      relations: ['achievement'],
    });

    // Create a map of user achievements
    const userAchievementMap = new Map(
      userAchievements.map((ua) => [ua.achievementId, ua]),
    );

    // Combine all achievements with user progress
    const progressList: UserAchievement[] = [];

    for (const achievement of allAchievements) {
      const userAchievement = userAchievementMap.get(achievement.id);

      if (userAchievement) {
        progressList.push(userAchievement);
      } else {
        // Create a placeholder for achievements not started
        const placeholder = this.userAchievementRepository.create({
          userId,
          achievementId: achievement.id,
          achievement,
          progress: 0,
          currentValue: 0,
          targetValue: achievement.criteria.target || null,
          isUnlocked: false,
        });
        progressList.push(placeholder);
      }
    }

    // Sort: unlocked first (by date), then by progress
    return progressList.sort((a, b) => {
      if (a.isUnlocked && !b.isUnlocked) return -1;
      if (!a.isUnlocked && b.isUnlocked) return 1;
      if (a.isUnlocked && b.isUnlocked) {
        return b.unlockedAt.getTime() - a.unlockedAt.getTime();
      }
      return b.progress - a.progress;
    });
  }

  /**
   * Manually unlock an achievement for a user
   */
  async unlockAchievement(
    userId: string,
    achievementId: string,
  ): Promise<UserAchievement> {
    const achievement = await this.findOne(achievementId);

    let userAchievement = await this.userAchievementRepository.findOne({
      where: { userId, achievementId },
    });

    if (!userAchievement) {
      userAchievement = this.userAchievementRepository.create({
        userId,
        achievementId,
        progress: 0,
        currentValue: 0,
        targetValue: achievement.criteria.target || null,
      });
    }

    if (userAchievement.isUnlocked) {
      this.logger.warn(
        `Achievement ${achievementId} already unlocked for user ${userId}`,
      );
      return userAchievement;
    }

    userAchievement.isUnlocked = true;
    userAchievement.unlockedAt = new Date();
    userAchievement.progress = 100;
    userAchievement.currentValue = userAchievement.targetValue || 1;

    await this.userAchievementRepository.save(userAchievement);

    // Send notification
    await this.notificationService.sendAchievementUnlockedNotification(
      userId,
      achievement,
    );

    this.logger.log(
      `Manually unlocked achievement ${achievement.name} for user ${userId}`,
    );

    return userAchievement;
  }

  /**
   * Process achievement checks for an event
   */
  async processAchievementEvent(
    userId: string,
    eventType: string,
    eventData?: any,
  ): Promise<Achievement[]> {
    const unlockedIds = await this.achievementCheckerService.checkAchievements({
      userId,
      eventType,
      eventData,
    });

    if (unlockedIds.length === 0) {
      return [];
    }

    const unlockedAchievements: Achievement[] = [];

    for (const achievementId of unlockedIds) {
      const achievement = await this.findOne(achievementId);
      unlockedAchievements.push(achievement);

      // Send notification
      await this.notificationService.sendAchievementUnlockedNotification(
        userId,
        achievement,
      );
    }

    return unlockedAchievements;
  }

  /**
   * Get achievement statistics for a user
   */
  async getUserAchievementStats(userId: string): Promise<{
    totalAchievements: number;
    unlockedAchievements: number;
    progress: number;
    totalXpEarned: number;
    rarityBreakdown: Record<string, number>;
  }> {
    const allAchievements = await this.achievementRepository.find({
      where: { isActive: true, isHidden: false },
    });

    const userAchievements = await this.userAchievementRepository.find({
      where: { userId, isUnlocked: true },
      relations: ['achievement'],
    });

    const totalAchievements = allAchievements.length;
    const unlockedAchievements = userAchievements.length;
    const progress =
      totalAchievements > 0
        ? (unlockedAchievements / totalAchievements) * 100
        : 0;

    const totalXpEarned = userAchievements.reduce(
      (sum, ua) => sum + (ua.achievement.xpBonus || 0),
      0,
    );

    const rarityBreakdown: Record<string, number> = {};
    userAchievements.forEach((ua) => {
      const rarity = ua.achievement.rarity;
      rarityBreakdown[rarity] = (rarityBreakdown[rarity] || 0) + 1;
    });

    return {
      totalAchievements,
      unlockedAchievements,
      progress: Math.round(progress * 100) / 100,
      totalXpEarned,
      rarityBreakdown,
    };
  }

  /**
   * Get recently unlocked achievements across all users
   */
  async getRecentlyUnlocked(limit = 10): Promise<UserAchievement[]> {
    return this.userAchievementRepository.find({
      where: { isUnlocked: true },
      relations: ['achievement'],
      order: { unlockedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get rarest achievements (least unlocked)
   */
  async getRarestAchievements(limit = 5): Promise<
    Array<{
      achievement: Achievement;
      unlockCount: number;
      unlockPercentage: number;
    }>
  > {
    const achievements = await this.achievementRepository.find({
      where: { isActive: true },
    });

    const achievementStats = await Promise.all(
      achievements.map(async (achievement) => {
        const unlockCount = await this.userAchievementRepository.count({
          where: { achievementId: achievement.id, isUnlocked: true },
        });

        // Get total user count (you'd need to implement this based on your user entity)
        const totalUsers = 100; // Placeholder

        return {
          achievement,
          unlockCount,
          unlockPercentage:
            totalUsers > 0 ? (unlockCount / totalUsers) * 100 : 0,
        };
      }),
    );

    return achievementStats
      .sort((a, b) => a.unlockCount - b.unlockCount)
      .slice(0, limit);
  }
}
