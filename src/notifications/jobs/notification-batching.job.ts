import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan, In } from 'typeorm';
import { Notification } from '../entities/notification.entity';
import { NotificationPreference } from '../entities/notification-preference.entity';
import { EmailNotificationService } from '../services/email-notification.service';
import { User } from '../../user/entities/user.entity';
import { NotificationChannel } from '../enums/notification-type.enum';

interface BatchedNotification {
  userId: string;
  userEmail: string;
  notifications: Notification[];
}

@Injectable()
export class NotificationBatchingJob {
  private readonly logger = new Logger(NotificationBatchingJob.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationPreference)
    private readonly preferenceRepository: Repository<NotificationPreference>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly emailService: EmailNotificationService,
  ) {}

  /**
   * Send daily digest emails at 8 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sendDailyDigest(): Promise<void> {
    this.logger.log('Starting daily notification digest');
    
    try {
      const batchedNotifications = await this.getBatchedNotifications('daily');
      const results = await this.sendDigestEmails(batchedNotifications, 'daily');
      
      this.logger.log(`Daily digest sent: ${results.sent} successful, ${results.failed} failed`);
    } catch (error) {
      this.logger.error('Failed to send daily digest:', error);
    }
  }

  /**
   * Send weekly digest emails on Monday at 9 AM
   */
  @Cron('0 9 * * 1') // Every Monday at 9 AM
  async sendWeeklyDigest(): Promise<void> {
    this.logger.log('Starting weekly notification digest');
    
    try {
      const batchedNotifications = await this.getBatchedNotifications('weekly');
      const results = await this.sendDigestEmails(batchedNotifications, 'weekly');
      
      this.logger.log(`Weekly digest sent: ${results.sent} successful, ${results.failed} failed`);
    } catch (error) {
      this.logger.error('Failed to send weekly digest:', error);
    }
  }

  /**
   * Batch notifications for immediate delivery every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async batchImmediateNotifications(): Promise<void> {
    this.logger.log('Processing immediate notification batch');
    
    try {
      // Get notifications created in the last 5 minutes that haven't been batched
      const fiveMinutesAgo = new Date();
      fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

      const notifications = await this.notificationRepository.find({
        where: {
          createdAt: MoreThan(fiveMinutesAgo),
          isDeleted: false,
          // Add a flag to track if notification was batched
          data: {
            batched: false,
          } as any,
        },
        relations: ['recipient', 'sender'],
        order: { createdAt: 'ASC' },
      });

      if (notifications.length === 0) {
        return;
      }

      // Group notifications by user
      const userNotifications = this.groupNotificationsByUser(notifications);
      
      // Send batched notifications
      let processed = 0;
      for (const batch of userNotifications) {
        if (batch.notifications.length >= 3) { // Only batch if 3+ notifications
          await this.sendBatchedNotification(batch);
          processed += batch.notifications.length;
        }
      }

      // Mark notifications as batched
      if (processed > 0) {
        await this.markNotificationsAsBatched(
          userNotifications.flatMap(batch => 
            batch.notifications.length >= 3 ? batch.notifications.map(n => n.id) : []
          )
        );
      }

      this.logger.log(`Processed ${processed} notifications in immediate batch`);
    } catch (error) {
      this.logger.error('Failed to process immediate notification batch:', error);
    }
  }

  /**
   * Get batched notifications for digest emails
   */
  private async getBatchedNotifications(period: 'daily' | 'weekly'): Promise<BatchedNotification[]> {
    const now = new Date();
    const startDate = new Date(now);
    
    if (period === 'daily') {
      startDate.setDate(startDate.getDate() - 1);
    } else {
      startDate.setDate(startDate.getDate() - 7);
    }
    
    startDate.setHours(0, 0, 0, 0);

    // Get users who have email digest enabled
    const emailPreferences = await this.preferenceRepository.find({
      where: {
        channel: NotificationChannel.EMAIL,
        isEnabled: true,
      },
      relations: ['user'],
    });

    const userIds = emailPreferences.map(pref => pref.userId);
    
    if (userIds.length === 0) {
      return [];
    }

    // Get notifications for these users in the time period
    const notifications = await this.notificationRepository.find({
      where: {
        recipientId: In(userIds),
        createdAt: MoreThan(startDate),
        isDeleted: false,
      },
      relations: ['recipient', 'sender'],
      order: { createdAt: 'DESC' },
    });

    return this.groupNotificationsByUser(notifications);
  }

  /**
   * Group notifications by user
   */
  private groupNotificationsByUser(notifications: Notification[]): BatchedNotification[] {
    const userGroups = new Map<string, BatchedNotification>();

    for (const notification of notifications) {
      const userId = notification.recipientId;
      const userEmail = notification.recipient?.email;

      if (!userEmail) {
        continue;
      }

      if (!userGroups.has(userId)) {
        userGroups.set(userId, {
          userId,
          userEmail,
          notifications: [],
        });
      }

      userGroups.get(userId)!.notifications.push(notification);
    }

    return Array.from(userGroups.values());
  }

  /**
   * Send digest emails to users
   */
  private async sendDigestEmails(
    batchedNotifications: BatchedNotification[],
    period: 'daily' | 'weekly',
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const batch of batchedNotifications) {
      if (batch.notifications.length === 0) {
        continue;
      }

      try {
        const success = await this.emailService.sendDigestEmail(
          batch.userEmail,
          batch.notifications,
          period,
        );

        if (success) {
          sent++;
        } else {
          failed++;
        }
      } catch (error) {
        this.logger.error(`Failed to send digest email to ${batch.userEmail}:`, error);
        failed++;
      }
    }

    return { sent, failed };
  }

  /**
   * Send batched notification for immediate delivery
   */
  private async sendBatchedNotification(batch: BatchedNotification): Promise<void> {
    try {
      // Create a summary notification
      const notificationTypes = Array.from(new Set(batch.notifications.map(n => n.type)));
      const title = `You have ${batch.notifications.length} new notifications`;
      const message = `Including ${notificationTypes.join(', ')} notifications`;

      // Send as single email
      await this.emailService.sendDigestEmail(
        batch.userEmail,
        batch.notifications,
        'daily', // Use daily template for immediate batches
      );

      this.logger.debug(`Sent batched notification to ${batch.userEmail} with ${batch.notifications.length} notifications`);
    } catch (error) {
      this.logger.error(`Failed to send batched notification to ${batch.userEmail}:`, error);
    }
  }

  /**
   * Mark notifications as batched
   */
  private async markNotificationsAsBatched(notificationIds: string[]): Promise<void> {
    if (notificationIds.length === 0) {
      return;
    }

    await this.notificationRepository.update(
      { id: In(notificationIds) },
      {
        data: () => "jsonb_set(data, '{batched}', 'true')",
      } as any,
    );
  }

  /**
   * Get batching statistics
   */
  async getBatchingStats(days: number = 7): Promise<{
    totalNotifications: number;
    batchedNotifications: number;
    digestEmailsSent: number;
    averageBatchSize: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const totalNotifications = await this.notificationRepository.count({
      where: {
        createdAt: MoreThan(startDate),
        isDeleted: false,
      },
    });

    const batchedNotifications = await this.notificationRepository.count({
      where: {
        createdAt: MoreThan(startDate),
        isDeleted: false,
        data: {
          batched: true,
        } as any,
      },
    });

    // This would require a separate table to track digest emails
    // For now, we'll estimate based on batched notifications
    const digestEmailsSent = Math.floor(batchedNotifications / 5); // Rough estimate
    const averageBatchSize = batchedNotifications > 0 ? batchedNotifications / digestEmailsSent : 0;

    return {
      totalNotifications,
      batchedNotifications,
      digestEmailsSent,
      averageBatchSize,
    };
  }

  /**
   * Manual trigger for testing
   */
  async triggerManualBatch(period: 'daily' | 'weekly' | 'immediate'): Promise<any> {
    this.logger.log(`Manually triggering ${period} batch`);

    switch (period) {
      case 'daily':
        return this.sendDailyDigest();
      case 'weekly':
        return this.sendWeeklyDigest();
      case 'immediate':
        return this.batchImmediateNotifications();
      default:
        throw new Error(`Unknown batch period: ${period}`);
    }
  }
}