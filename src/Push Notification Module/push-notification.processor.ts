import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import {
  PUSH_NOTIFICATION_QUEUE,
  PushJobName,
} from '../queue/push-queue.constants';
import { PushJobData } from '../interfaces/push-notification.interface';
import { PushNotificationService } from '../services/push-notification.service';

@Processor(PUSH_NOTIFICATION_QUEUE, {
  concurrency: 5,
})
export class PushNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(PushNotificationProcessor.name);

  constructor(private readonly pushService: PushNotificationService) {
    super();
  }

  async process(job: Job<PushJobData>): Promise<unknown> {
    this.logger.debug(`Processing job ${job.id} name=${job.name} attempt=${job.attemptsMade + 1}`);

    switch (job.name) {
      case PushJobName.SEND_TO_USER:
        return this.handleSendToUser(job);
      case PushJobName.SEND_TO_USERS:
        return this.handleSendToUsers(job);
      case PushJobName.SEND_TO_TOPIC:
        return this.handleSendToTopic(job);
      case PushJobName.CLEANUP_INVALID_TOKENS:
        return this.handleCleanup(job);
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
        return null;
    }
  }

  private async handleSendToUser(job: Job<PushJobData>) {
    const { userId, payload, notificationType } = job.data;
    if (!userId) throw new Error('userId is required for SEND_TO_USER job');
    const result = await this.pushService.deliverToUser(
      userId,
      payload,
      notificationType,
    );
    this.logger.log(
      `SEND_TO_USER job=${job.id} userId=${userId} success=${result.successCount} failed=${result.failureCount} invalidTokens=${result.invalidTokens.length}`,
    );
    return result;
  }

  private async handleSendToUsers(job: Job<PushJobData>) {
    const { userIds, payload, notificationType } = job.data;
    if (!userIds?.length) throw new Error('userIds are required for SEND_TO_USERS job');
    const result = await this.pushService.deliverToUsers(
      userIds,
      payload,
      notificationType,
    );
    this.logger.log(
      `SEND_TO_USERS job=${job.id} userCount=${userIds.length} success=${result.successCount} failed=${result.failureCount}`,
    );
    return result;
  }

  private async handleSendToTopic(job: Job<PushJobData>) {
    const { topic, payload } = job.data;
    if (!topic) throw new Error('topic is required for SEND_TO_TOPIC job');
    await this.pushService.deliverToTopic(topic, payload);
    this.logger.log(`SEND_TO_TOPIC job=${job.id} topic=${topic}`);
    return { topic, delivered: true };
  }

  private async handleCleanup(job: Job<PushJobData & { tokens?: string[] }>) {
    const tokens: string[] = (job.data as any).tokens ?? [];
    const removed = await this.pushService.cleanupInvalidTokens(tokens);
    this.logger.log(`CLEANUP job=${job.id} removed=${removed} tokens`);
    return { removed };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<PushJobData>, error: Error) {
    const isLastAttempt = job.attemptsMade >= (job.opts?.attempts ?? 3);
    if (isLastAttempt) {
      this.logger.error(
        `Job ${job.id} (${job.name}) permanently failed after ${job.attemptsMade} attempts: ${error.message}`,
        error.stack,
      );
    } else {
      this.logger.warn(
        `Job ${job.id} (${job.name}) attempt ${job.attemptsMade} failed: ${error.message}. Retrying...`,
      );
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<PushJobData>) {
    this.logger.debug(`Job ${job.id} (${job.name}) completed successfully`);
  }
}
