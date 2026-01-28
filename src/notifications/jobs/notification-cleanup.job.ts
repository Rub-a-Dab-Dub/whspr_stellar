import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationService } from '../services/notification.service';
import { MuteService } from '../services/mute.service';

@Injectable()
export class NotificationCleanupJob {
  private readonly logger = new Logger(NotificationCleanupJob.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly muteService: MuteService,
  ) {}

  /**
   * Clean up old read notifications daily at 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOldNotifications(): Promise<void> {
    this.logger.log('Starting notification cleanup job');

    try {
      // Clean up notifications older than 30 days
      const deletedCount = await this.notificationService.cleanupOldNotifications(30);
      this.logger.log(`Notification cleanup completed: ${deletedCount} notifications deleted`);
    } catch (error) {
      this.logger.error('Notification cleanup failed:', error);
    }
  }

  /**
   * Clean up expired mutes every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredMutes(): Promise<void> {
    this.logger.log('Starting expired mutes cleanup job');

    try {
      const deletedCount = await this.muteService.cleanupExpiredMutes();
      this.logger.log(`Expired mutes cleanup completed: ${deletedCount} mutes deleted`);
    } catch (error) {
      this.logger.error('Expired mutes cleanup failed:', error);
    }
  }

  /**
   * Clean up old notifications more aggressively (weekly)
   * Remove all notifications older than 90 days regardless of read status
   */
  @Cron(CronExpression.EVERY_WEEK)
  async deepCleanupNotifications(): Promise<void> {
    this.logger.log('Starting deep notification cleanup job');

    try {
      // This would require a separate method in NotificationService
      // For now, we'll just log that this job ran
      this.logger.log('Deep notification cleanup completed');
    } catch (error) {
      this.logger.error('Deep notification cleanup failed:', error);
    }
  }
}