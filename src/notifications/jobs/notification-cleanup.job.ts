import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationService } from '../services/notification.service';
import { PushNotificationService } from '../services/push-notification.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { Notification } from '../entities/notification.entity';

@Injectable()
export class NotificationCleanupJob {
  private readonly logger = new Logger(NotificationCleanupJob.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly pushService: PushNotificationService,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  /**
   * Clean up expired notifications daily at 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredNotifications(): Promise<void> {
    this.logger.log('Starting expired notifications cleanup');
    
    try {
      const cleanedCount = await this.notificationService.cleanupExpiredNotifications();
      this.logger.log(`Cleaned up ${cleanedCount} expired notifications`);
    } catch (error) {
      this.logger.error('Failed to cleanup expired notifications:', error);
    }
  }

  /**
   * Clean up old deleted notifications weekly
   */
  @Cron(CronExpression.EVERY_WEEK)
  async cleanupOldDeletedNotifications(): Promise<void> {
    this.logger.log('Starting old deleted notifications cleanup');
    
    try {
      // Delete notifications that were soft-deleted more than 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await this.notificationRepository.delete({
        isDeleted: true,
        deletedAt: LessThan(thirtyDaysAgo),
      });

      this.logger.log(`Permanently deleted ${result.affected || 0} old notifications`);
    } catch (error) {
      this.logger.error('Failed to cleanup old deleted notifications:', error);
    }
  }

  /**
   * Clean up old read notifications monthly
   */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async cleanupOldReadNotifications(): Promise<void> {
    this.logger.log('Starting old read notifications cleanup');
    
    try {
      // Delete read notifications older than 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const result = await this.notificationRepository.update(
        {
          isRead: true,
          readAt: LessThan(ninetyDaysAgo),
          isDeleted: false,
        },
        {
          isDeleted: true,
          deletedAt: new Date(),
        },
      );

      this.logger.log(`Soft deleted ${result.affected || 0} old read notifications`);
    } catch (error) {
      this.logger.error('Failed to cleanup old read notifications:', error);
    }
  }

  /**
   * Clean up inactive push subscriptions weekly
   */
  @Cron(CronExpression.EVERY_WEEK)
  async cleanupInactivePushSubscriptions(): Promise<void> {
    this.logger.log('Starting inactive push subscriptions cleanup');
    
    try {
      const cleanedCount = await this.pushService.cleanupInactiveSubscriptions(30);
      this.logger.log(`Cleaned up ${cleanedCount} inactive push subscriptions`);
    } catch (error) {
      this.logger.error('Failed to cleanup inactive push subscriptions:', error);
    }
  }

  /**
   * Generate notification statistics daily
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateNotificationStats(): Promise<void> {
    this.logger.log('Generating notification statistics');
    
    try {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      
      const endOfYesterday = new Date(yesterday);
      endOfYesterday.setHours(23, 59, 59, 999);

      // Count notifications created yesterday
      const createdCount = await this.notificationRepository.count({
        where: {
          createdAt: MoreThan(yesterday),
        },
      });

      // Count notifications read yesterday
      const readCount = await this.notificationRepository.count({
        where: {
          readAt: MoreThan(yesterday),
        },
      });

      // Count total unread notifications
      const unreadCount = await this.notificationRepository.count({
        where: {
          isRead: false,
          isDeleted: false,
        },
      });

      this.logger.log(`Daily stats - Created: ${createdCount}, Read: ${readCount}, Unread: ${unreadCount}`);
      
      // Here you could save these stats to a separate analytics table
      // or send them to an analytics service
      
    } catch (error) {
      this.logger.error('Failed to generate notification statistics:', error);
    }
  }

  /**
   * Manual cleanup method for testing
   */
  async runManualCleanup(): Promise<{
    expiredNotifications: number;
    oldDeletedNotifications: number;
    oldReadNotifications: number;
    inactivePushSubscriptions: number;
  }> {
    this.logger.log('Running manual cleanup');
    
    const results = {
      expiredNotifications: 0,
      oldDeletedNotifications: 0,
      oldReadNotifications: 0,
      inactivePushSubscriptions: 0,
    };

    try {
      // Clean expired notifications
      results.expiredNotifications = await this.notificationService.cleanupExpiredNotifications();

      // Clean old deleted notifications
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const deletedResult = await this.notificationRepository.delete({
        isDeleted: true,
        deletedAt: LessThan(thirtyDaysAgo),
      });
      results.oldDeletedNotifications = deletedResult.affected || 0;

      // Clean old read notifications
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      
      const readResult = await this.notificationRepository.update(
        {
          isRead: true,
          readAt: LessThan(ninetyDaysAgo),
          isDeleted: false,
        },
        {
          isDeleted: true,
          deletedAt: new Date(),
        },
      );
      results.oldReadNotifications = readResult.affected || 0;

      // Clean inactive push subscriptions
      results.inactivePushSubscriptions = await this.pushService.cleanupInactiveSubscriptions(30);

      this.logger.log('Manual cleanup completed:', results);
      return results;
    } catch (error) {
      this.logger.error('Manual cleanup failed:', error);
      throw error;
    }
  }
}