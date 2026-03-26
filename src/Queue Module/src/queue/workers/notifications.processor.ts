import { Processor, OnQueueActive, OnQueueFailed, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
@Processor('notifications')
export class NotificationsProcessor {
  private readonly logger = new Logger(NotificationsProcessor.name);
  constructor(@InjectQueue('dead-letter') private readonly dlq: Queue) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing notification job ${job.id}`);
  }

  async process(job: Job<{ userId: string; message: string }>) {
    // Simulate sending notification (e.g., websocket, push)
    this.logger.log(`Sending notification to ${job.data.userId}: ${job.data.message}`);
    // progress example
    await job.updateProgress(50);
    // pretend async call
    await new Promise((r) => setTimeout(r, 50));
    await job.updateProgress(100);
    return { ok: true };
  }

  @OnQueueFailed()
  async onFailed(job: Job, err: Error) {
    this.logger.error(`Notification job ${job.id} failed: ${err.message}`);
    const attempts = (job.opts && (job.opts as any).attempts) || 3;
    if ((job.attemptsMade || 0) >= attempts) {
      await this.dlq.add('failed-job', {
        origQueue: job.queueName,
        name: job.name,
        data: job.data,
        failedReason: err.message,
        attemptsMade: job.attemptsMade,
      });
    }
  }
}
