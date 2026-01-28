import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { NotificationBatch } from '../entities/notification-batch.entity';
import { Notification } from '../entities/notification.entity';
import { NotificationBatchStatus } from '../enums/notification-batch-status.enum';
import { NotificationStatus } from '../enums/notification-status.enum';
import { QueueService } from '../../queue/queue.service';

@Injectable()
export class NotificationBatchJob {
  private readonly logger = new Logger(NotificationBatchJob.name);

  constructor(
    @InjectRepository(NotificationBatch)
    private readonly batchRepository: Repository<NotificationBatch>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly queueService: QueueService,
  ) {}

  /**
   * Process scheduled notification batches every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledBatches(): Promise<void> {
    const now = new Date();
    
    const scheduledBatches = await this.batchRepository.find({
      where: {
        status: NotificationBatchStatus.PENDING,
        scheduledFor: LessThanOrEqual(now),
      },
      order: { scheduledFor: 'ASC' },
      take: 10, // Process up to 10 batches at a time
    });

    if (scheduledBatches.length === 0) {
      return;
    }

    this.logger.log(`Processing ${scheduledBatches.length} scheduled notification batches`);

    for (const batch of scheduledBatches) {
      await this.processBatch(batch);
    }
  }

  /**
   * Process a single notification batch
   */
  private async processBatch(batch: NotificationBatch): Promise<void> {
    try {
      // Update batch status to processing
      batch.status = NotificationBatchStatus.PROCESSING;
      batch.startedAt = new Date();
      await this.batchRepository.save(batch);

      // Get notifications for this batch
      const notifications = await this.notificationRepository.find({
        where: {
          // Assuming we have a batchId field in notifications
          // This would need to be added to the notification entity
          status: NotificationStatus.PENDING,
        },
        // Add batch filtering logic here based on your requirements
      });

      let sentCount = 0;
      let failedCount = 0;

      // Process notifications in smaller chunks
      const chunkSize = 100;
      for (let i = 0; i < notifications.length; i += chunkSize) {
        const chunk = notifications.slice(i, i + chunkSize);
        
        const results = await Promise.allSettled(
          chunk.map(notification => this.processNotification(notification))
        );

        results.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            sentCount++;
          } else {
            failedCount++;
            this.logger.error(`Failed to process notification ${chunk[index].id}:`, result);
          }
        });

        // Update batch progress
        batch.sentNotifications = sentCount;
        batch.failedNotifications = failedCount;
        await this.batchRepository.save(batch);
      }

      // Mark batch as completed
      batch.status = NotificationBatchStatus.COMPLETED;
      batch.completedAt = new Date();
      batch.totalNotifications = notifications.length;
      batch.sentNotifications = sentCount;
      batch.failedNotifications = failedCount;
      
      await this.batchRepository.save(batch);

      this.logger.log(`Batch ${batch.id} completed: ${sentCount} sent, ${failedCount} failed`);
    } catch (error) {
      this.logger.error(`Failed to process batch ${batch.id}:`, error);
      
      // Mark batch as failed
      batch.status = NotificationBatchStatus.FAILED;
      batch.completedAt = new Date();
      await this.batchRepository.save(batch);
    }
  }

  /**
   * Process a single notification
   */
  private async processNotification(notification: Notification): Promise<boolean> {
    try {
      // Queue the notification for delivery
      await this.queueService.addNotificationJob({
        notificationId: notification.id,
        recipientId: notification.recipientId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
      });

      // Update notification status
      notification.status = NotificationStatus.SENT;
      notification.sentAt = new Date();
      await this.notificationRepository.save(notification);

      return true;
    } catch (error) {
      this.logger.error(`Failed to process notification ${notification.id}:`, error);
      
      // Update notification status to failed
      notification.status = NotificationStatus.FAILED;
      notification.errorMessage = error.message;
      notification.retryCount = (notification.retryCount || 0) + 1;
      await this.notificationRepository.save(notification);

      return false;
    }
  }

  /**
   * Create a notification batch
   */
  async createBatch(
    name: string,
    description: string,
    scheduledFor?: Date,
    metadata?: Record<string, any>,
  ): Promise<NotificationBatch> {
    const batch = this.batchRepository.create({
      name,
      description,
      scheduledFor,
      metadata: metadata || {},
      status: NotificationBatchStatus.PENDING,
    });

    const savedBatch = await this.batchRepository.save(batch);
    this.logger.log(`Created notification batch: ${savedBatch.id}`);
    
    return savedBatch;
  }

  /**
   * Add notifications to a batch
   */
  async addNotificationsToBatch(
    batchId: string,
    notifications: Partial<Notification>[],
  ): Promise<void> {
    const batch = await this.batchRepository.findOne({ where: { id: batchId } });
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    // Create notifications with batch reference
    const notificationEntities = notifications.map(notificationData => 
      this.notificationRepository.create({
        ...notificationData,
        // Add batchId field to notification entity if needed
      })
    );

    await this.notificationRepository.save(notificationEntities);

    // Update batch total count
    batch.totalNotifications = (batch.totalNotifications || 0) + notifications.length;
    await this.batchRepository.save(batch);

    this.logger.log(`Added ${notifications.length} notifications to batch ${batchId}`);
  }

  /**
   * Cancel a batch
   */
  async cancelBatch(batchId: string): Promise<void> {
    const batch = await this.batchRepository.findOne({ where: { id: batchId } });
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    if (batch.status === NotificationBatchStatus.PROCESSING) {
      throw new Error('Cannot cancel a batch that is currently processing');
    }

    batch.status = NotificationBatchStatus.CANCELLED;
    batch.completedAt = new Date();
    await this.batchRepository.save(batch);

    this.logger.log(`Cancelled notification batch: ${batchId}`);
  }

  /**
   * Get batch status
   */
  async getBatchStatus(batchId: string): Promise<NotificationBatch | null> {
    return this.batchRepository.findOne({ where: { id: batchId } });
  }

  /**
   * Clean up old completed batches
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldBatches(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7); // Keep batches for 7 days

    const result = await this.batchRepository.delete({
      status: NotificationBatchStatus.COMPLETED,
      completedAt: LessThanOrEqual(cutoffDate),
    });

    this.logger.log(`Cleaned up ${result.affected} old notification batches`);
  }
}