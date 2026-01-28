import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Achievement, AchievementType } from '../entities/achievement.entity';
import { UserAchievement } from '../entities/user-achievement.entity';

export interface AchievementCheckContext {
  userId: string;
  eventType: string;
  eventData?: any;
}

@Injectable()
export class AchievementCheckerService {
  private readonly logger = new Logger(AchievementCheckerService.name);

  constructor(
    @InjectRepository(Achievement)
    private achievementRepository: Repository<Achievement>,
    @InjectRepository(UserAchievement)
    private userAchievementRepository: Repository<UserAchievement>,
  ) {}

  /**
   * Check achievements for a user based on an event
   */
  async checkAchievements(context: AchievementCheckContext): Promise<string[]> {
    const { userId, eventType, eventData } = context;

    this.logger.debug(
      `Checking achievements for user ${userId} on event ${eventType}`,
    );

    // Get all active achievements
    const achievements = await this.achievementRepository.find({
      where: { isActive: true },
    });

    const unlockedAchievementIds: string[] = [];

    for (const achievement of achievements) {
      const shouldCheck = await this.shouldCheckAchievement(
        achievement,
        eventType,
      );

      if (!shouldCheck) {
        continue;
      }

      const isUnlocked = await this.checkSingleAchievement(
        userId,
        achievement,
        eventData,
      );

      if (isUnlocked) {
        unlockedAchievementIds.push(achievement.id);
      }
    }

    return unlockedAchievementIds;
  }

  /**
   * Check if an achievement should be evaluated for this event type
   */
  private async shouldCheckAchievement(
    achievement: Achievement,
    eventType: string,
  ): Promise<boolean> {
    const criteriaType = achievement.criteria.type;

    // Map event types to achievement types
    const eventToAchievementMap: Record<string, string[]> = {
      'message.created': ['message_count', 'first_message', 'night_owl'],
      'room.created': ['room_count', 'room_creator'],
      'user.joined': ['early_adopter'],
      'conversation.started': ['conversation_starter', 'social_butterfly'],
    };

    const relevantTypes = eventToAchievementMap[eventType] || [];
    return relevantTypes.includes(criteriaType);
  }

  /**
   * Check a single achievement for a user
   */
  private async checkSingleAchievement(
    userId: string,
    achievement: Achievement,
    eventData: any,
  ): Promise<boolean> {
    // Get or create user achievement record
    let userAchievement = await this.userAchievementRepository.findOne({
      where: { userId, achievementId: achievement.id },
    });

    if (!userAchievement) {
      userAchievement = this.userAchievementRepository.create({
        userId,
        achievementId: achievement.id,
        progress: 0,
        currentValue: 0,
        targetValue: achievement.criteria.target || null,
        isUnlocked: false,
      });
    }

    // Skip if already unlocked
    if (userAchievement.isUnlocked) {
      return false;
    }

    // Check criteria
    const meetsRequirement = await this.evaluateCriteria(
      achievement.criteria,
      userId,
      eventData,
      userAchievement,
    );

    if (meetsRequirement) {
      userAchievement.isUnlocked = true;
      userAchievement.unlockedAt = new Date();
      userAchievement.progress = 100;

      await this.userAchievementRepository.save(userAchievement);

      this.logger.log(
        `Achievement unlocked: ${achievement.name} for user ${userId}`,
      );
      return true;
    } else {
      // Update progress
      await this.userAchievementRepository.save(userAchievement);
    }

    return false;
  }

  /**
   * Evaluate achievement criteria
   */
  private async evaluateCriteria(
    criteria: any,
    userId: string,
    eventData: any,
    userAchievement: UserAchievement,
  ): Promise<boolean> {
    const { type, target, condition } = criteria;

    switch (type) {
      case 'message_count':
        return this.checkMessageCount(userId, target, userAchievement);

      case 'room_count':
        return this.checkRoomCount(userId, target, userAchievement);

      case 'first_message':
        return this.checkFirstMessage(userId, userAchievement);

      case 'room_creator':
        return this.checkRoomCreator(userId, userAchievement);

      case 'early_adopter':
        return this.checkEarlyAdopter(userId, userAchievement);

      case 'night_owl':
        return this.checkNightOwl(eventData, userAchievement);

      case 'social_butterfly':
        return this.checkSocialButterfly(userId, target, userAchievement);

      case 'conversation_starter':
        return this.checkConversationStarter(userId, target, userAchievement);

      case 'veteran':
        return this.checkVeteran(userId, userAchievement);

      default:
        this.logger.warn(`Unknown criteria type: ${type}`);
        return false;
    }
  }

  /**
   * Individual achievement checking methods
   */
  private async checkMessageCount(
    userId: string,
    target: number,
    userAchievement: UserAchievement,
  ): Promise<boolean> {
    // This would query your message table
    // For now, we'll increment the current value
    userAchievement.currentValue += 1;
    userAchievement.targetValue = target;
    userAchievement.progress = Math.min(
      (userAchievement.currentValue / target) * 100,
      100,
    );

    return userAchievement.currentValue >= target;
  }

  private async checkRoomCount(
    userId: string,
    target: number,
    userAchievement: UserAchievement,
  ): Promise<boolean> {
    userAchievement.currentValue += 1;
    userAchievement.targetValue = target;
    userAchievement.progress = Math.min(
      (userAchievement.currentValue / target) * 100,
      100,
    );

    return userAchievement.currentValue >= target;
  }

  private async checkFirstMessage(
    userId: string,
    userAchievement: UserAchievement,
  ): Promise<boolean> {
    // Check if this is the user's first message
    // This would typically query the database
    userAchievement.currentValue = 1;
    userAchievement.targetValue = 1;
    userAchievement.progress = 100;
    return true;
  }

  private async checkRoomCreator(
    userId: string,
    userAchievement: UserAchievement,
  ): Promise<boolean> {
    // Check if user has created at least one room
    userAchievement.currentValue = 1;
    userAchievement.targetValue = 1;
    userAchievement.progress = 100;
    return true;
  }

  private async checkEarlyAdopter(
    userId: string,
    userAchievement: UserAchievement,
  ): Promise<boolean> {
    // Check if user is among the first N users
    // This would query the user creation date
    userAchievement.progress = 100;
    return true; // Simplified for example
  }

  private async checkNightOwl(
    eventData: any,
    userAchievement: UserAchievement,
  ): Promise<boolean> {
    // Check if message was sent between midnight and 5 AM
    const hour = new Date().getHours();
    const isNightTime = hour >= 0 && hour < 5;

    if (isNightTime) {
      userAchievement.currentValue += 1;
      const target = 10; // Send 10 messages at night
      userAchievement.targetValue = target;
      userAchievement.progress = Math.min(
        (userAchievement.currentValue / target) * 100,
        100,
      );
      return userAchievement.currentValue >= target;
    }

    return false;
  }

  private async checkSocialButterfly(
    userId: string,
    target: number,
    userAchievement: UserAchievement,
  ): Promise<boolean> {
    // Check if user has interacted with N different users
    // This would query unique user interactions
    userAchievement.currentValue += 1;
    userAchievement.targetValue = target;
    userAchievement.progress = Math.min(
      (userAchievement.currentValue / target) * 100,
      100,
    );

    return userAchievement.currentValue >= target;
  }

  private async checkConversationStarter(
    userId: string,
    target: number,
    userAchievement: UserAchievement,
  ): Promise<boolean> {
    // Check if user has started N conversations
    userAchievement.currentValue += 1;
    userAchievement.targetValue = target;
    userAchievement.progress = Math.min(
      (userAchievement.currentValue / target) * 100,
      100,
    );

    return userAchievement.currentValue >= target;
  }

  private async checkVeteran(
    userId: string,
    userAchievement: UserAchievement,
  ): Promise<boolean> {
    // Check if user account is older than 1 year
    // This would query user creation date
    userAchievement.progress = 100;
    return true; // Simplified for example
  }

  /**
   * Get achievement progress for a user
   */
  async getAchievementProgress(
    userId: string,
    achievementId: string,
  ): Promise<UserAchievement | null> {
    return this.userAchievementRepository.findOne({
      where: { userId, achievementId },
      relations: ['achievement'],
    });
  }

  /**
   * Get all user achievements with progress
   */
  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    return this.userAchievementRepository.find({
      where: { userId },
      relations: ['achievement'],
      order: { createdAt: 'DESC' },
    });
  }
}
