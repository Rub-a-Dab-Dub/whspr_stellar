import { Processor, OnQueueActive, OnQueueFailed, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
@Processor('event-indexing')
export class EventIndexingProcessor {
  private readonly logger = new Logger(EventIndexingProcessor.name);

  constructor(@InjectQueue('dead-letter') private readonly dlq: Queue) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing event index job ${job.id}`);
  }

  async process(job: Job<{ eventId: string; data: any }>) {
    this.logger.log(`Indexing event ${job.data.eventId}`);
    await job.updateProgress(40);
    // simulate indexing
    await new Promise((r) => setTimeout(r, 120));
    await job.updateProgress(100);
    return { indexed: true };
  }

  @OnQueueFailed()
  async onFailed(job: Job, err: Error) {
    this.logger.error(`Event index job ${job.id} failed: ${err.message}`);
    const attempts = (job.opts && (job.opts as any).attempts) || 3;
    if ((job.attemptsMade || 0) >= attempts) {
      await this.dlq.add('failed-job', { origQueue: job.queueName, name: job.name, data: job.data, failedReason: err.message });
    }
  }
}
