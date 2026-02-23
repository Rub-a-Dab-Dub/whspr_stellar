import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { WebhookService } from '../services/webhook.service';
import { QUEUE_NAMES } from '../../queue/queue.constants';

interface WebhookDeliveryJobData {
  deliveryId: string;
}

@Processor(QUEUE_NAMES.WEBHOOK_DELIVERIES)
export class WebhookDeliveryProcessor {
  private readonly logger = new Logger(WebhookDeliveryProcessor.name);

  constructor(private readonly webhookService: WebhookService) {}

  @Process('deliver-webhook')
  async handleDelivery(job: Job<WebhookDeliveryJobData>): Promise<void> {
    const { deliveryId } = job.data;
    this.logger.log(
      `Processing webhook delivery ${deliveryId} (attempt ${job.attemptsMade + 1})`,
    );
    await this.webhookService.processDelivery(deliveryId);
  }

  @OnQueueFailed()
  async onFailed(job: Job<WebhookDeliveryJobData>, err: Error): Promise<void> {
    const { deliveryId } = job.data;
    const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 1) - 1;

    this.logger.error(
      `Webhook delivery job failed for ${deliveryId} (attempt ${job.attemptsMade + 1}): ${err.message}`,
    );

    if (isLastAttempt) {
      this.logger.error(
        `All retry attempts exhausted for delivery ${deliveryId}, marking as failed`,
      );
      await this.webhookService.handleDeliveryJobFailed(deliveryId);
    }
  }
}
