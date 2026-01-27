import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Achievement } from '../entities/achievement.entity';
import { UserAchievement } from '../entities/user-achievement.entity';

export interface AchievementNotification {
  userId: string;
  achievementId: string;
  achievementName: string;
  achievementDescription: string;
  rarity: string;
  xpBonus: number;
  timestamp: Date;
}

@Injectable()
export class AchievementNotificationService {
  private readonly logger = new Logger(AchievementNotificationService.name);

  constructor(
    @InjectRepository(UserAchievement)
    private userAchievementRepository: Repository<UserAchievement>,
  ) {}

  /**
   * Send achievement unlocked notification
   */
  async sendAchievementUnlockedNotification(
    userId: string,
    achievement: Achievement,
  ): Promise<void> {
    const notification: AchievementNotification = {
      userId,
      achievementId: achievement.id,
      achievementName: achievement.name,
      achievementDescription: achievement.description,
      rarity: achievement.rarity,
      xpBonus: achievement.xpBonus,
      timestamp: new Date(),
    };

    // Here you would integrate with your notification system
    // Examples:
    // - WebSocket/Socket.io for real-time notifications
    // - Email service
    // - Push notifications
    // - In-app notification queue

    this.logger.log(
      `Achievement unlocked notification sent to user ${userId}: ${achievement.name}`,
    );

    // Mark notification as sent
    await this.markNotificationSent(userId, achievement.id);

    // You could also emit an event here for other parts of the system
    // this.eventEmitter.emit('achievement.unlocked', notification);
  }

  /**
   * Mark notification as sent
   */
  private async markNotificationSent(
    userId: string,
    achievementId: string,
  ): Promise<void> {
    await this.userAchievementRepository.update(
      { userId, achievementId },
      { notificationSent: true },
    );
  }

  /**
   * Get pending notifications for a user
   */
  async getPendingNotifications(userId: string): Promise<UserAchievement[]> {
    return this.userAchievementRepository.find({
      where: {
        userId,
        isUnlocked: true,
        notificationSent: false,
      },
      relations: ['achievement'],
      order: { unlockedAt: 'DESC' },
    });
  }

  /**
   * Batch send pending notifications
   */
  async sendPendingNotifications(userId: string): Promise<number> {
    const pending = await this.getPendingNotifications(userId);

    for (const userAchievement of pending) {
      await this.sendAchievementUnlockedNotification(
        userId,
        userAchievement.achievement,
      );
    }

    return pending.length;
  }

  /**
   * Create notification payload for WebSocket/real-time systems
   */
  createNotificationPayload(
    achievement: Achievement,
    userAchievement: UserAchievement,
  ): any {
    return {
      type: 'ACHIEVEMENT_UNLOCKED',
      data: {
        id: userAchievement.id,
        achievement: {
          id: achievement.id,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          rarity: achievement.rarity,
          xpBonus: achievement.xpBonus,
        },
        unlockedAt: userAchievement.unlockedAt,
        progress: userAchievement.progress,
      },
      timestamp: new Date(),
    };
  }
}
