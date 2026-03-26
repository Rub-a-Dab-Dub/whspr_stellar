import { Processor, OnQueueActive, OnQueueFailed, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
@Processor('media-processing')
export class MediaProcessor {
  private readonly logger = new Logger(MediaProcessor.name);

  constructor(@InjectQueue('dead-letter') private readonly dlq: Queue) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing media job ${job.id}`);
  }

  async process(job: Job<{ filePath: string; transform: string }>) {
    this.logger.log(`Processing file ${job.data.filePath} with ${job.data.transform}`);
    await job.updateProgress(30);
    // simulate image processing
    await new Promise((r) => setTimeout(r, 150));
    await job.updateProgress(100);
    return { outPath: job.data.filePath + '.out' };
  }

  @OnQueueFailed()
  async onFailed(job: Job, err: Error) {
    this.logger.error(`Media job ${job.id} failed: ${err.message}`);
    const attempts = (job.opts && (job.opts as any).attempts) || 3;
    if ((job.attemptsMade || 0) >= attempts) {
      await this.dlq.add('failed-job', { origQueue: job.queueName, name: job.name, data: job.data, failedReason: err.message });
    }
  }
}
