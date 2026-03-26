import { Processor, OnQueueActive, OnQueueFailed, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(@InjectQueue('dead-letter') private readonly dlq: Queue) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing email job ${job.id}`);
  }

  async process(job: Job<{ to: string; subject: string; body: string }>) {
    this.logger.log(`Sending email to ${job.data.to} subject=${job.data.subject}`);
    await job.updateProgress(50);
    // simulate email send
    await new Promise((r) => setTimeout(r, 100));
    await job.updateProgress(100);
    return { sent: true };
  }

  @OnQueueFailed()
  async onFailed(job: Job, err: Error) {
    this.logger.error(`Email job ${job.id} failed: ${err.message}`);
    const attempts = (job.opts && (job.opts as any).attempts) || 3;
    if ((job.attemptsMade || 0) >= attempts) {
      await this.dlq.add('failed-job', { origQueue: job.queueName, name: job.name, data: job.data, failedReason: err.message });
    }
  }
}
