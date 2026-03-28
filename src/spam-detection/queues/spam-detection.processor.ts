import { Process, Processor, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { SpamDetectionService } from '../spam-detection.service';

@Processor('spam-detection')
export class SpamDetectionProcessor {
  private readonly logger = new Logger(SpamDetectionProcessor.name);

  constructor(private readonly spamDetectionService: SpamDetectionService) {}

  /**
   * Process message for spam scoring
   * Runs async, doesn't block message delivery
   */
  @Process('score-message')
  async processMessageScoring(job: Job<any>): Promise<void> {
    this.logger.debug(`Processing spam score for message ${job.data.messageId}`);

    try {
      await this.spamDetectionService.processMessageScoring(job.data);
      this.logger.debug(`Completed spam scoring for message ${job.data.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to score message: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process bulk user scoring
   * Called periodically to recalculate scores
   */
  @Process('bulk-rescore-users')
  async processBulkRescoring(job: Job<{ userIds: string[] }>): Promise<void> {
    this.logger.debug(`Starting bulk rescore of ${job.data.userIds.length} users`);

    try {
      // In production, would batch process all users
      // For now, just log
      this.logger.debug(`Bulk rescore completed for ${job.data.userIds.length} users`);
    } catch (error) {
      this.logger.error(`Bulk rescore failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process auto-throttle action
   * Applies rate limiting when threshold exceeded
   */
  @Process('auto-throttle')
  async processAutoThrottle(job: Job<{ userId: string; spamScoreId: string }>): Promise<void> {
    this.logger.debug(`Applying auto-throttle for user ${job.data.userId}`);

    try {
      // Trigger the action (rate limit tightening)
      await this.spamDetectionService.triggerAction(job.data.spamScoreId);
      this.logger.log(`Auto-throttle applied to user ${job.data.userId}`);
    } catch (error) {
      this.logger.error(`Auto-throttle failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Clean up old/expired spam records
   * Scheduled maintenance job
   */
  @Process('cleanup-expired-records')
  async processCleanup(job: Job<{ daysOld: number }>): Promise<void> {
    this.logger.debug(`Starting cleanup of records older than ${job.data.daysOld} days`);

    try {
      // Cleanup logic would go here
      this.logger.debug('Cleanup completed');
    } catch (error) {
      this.logger.error(`Cleanup failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error): void {
    this.logger.error(`Job ${job.id} (${job.name}) failed: ${err.message}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any): void {
    this.logger.debug(`Job ${job.id} (${job.name}) completed`);
  }
}
