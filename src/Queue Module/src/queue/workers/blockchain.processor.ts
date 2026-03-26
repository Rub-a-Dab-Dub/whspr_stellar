import { Processor, OnQueueActive, OnQueueFailed, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
@Processor('blockchain-tx')
export class BlockchainProcessor {
  private readonly logger = new Logger(BlockchainProcessor.name);

  constructor(@InjectQueue('dead-letter') private readonly dlq: Queue) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing blockchain tx job ${job.id}`);
  }

  async process(job: Job<{ txPayload: any }>) {
    this.logger.log(`Submitting tx: ${JSON.stringify(job.data.txPayload)}`);
    await job.updateProgress(20);
    // simulate submission
    await new Promise((r) => setTimeout(r, 200));
    await job.updateProgress(80);
    // simulate response
    const txHash = '0x' + Math.random().toString(16).slice(2, 10);
    await job.updateProgress(100);
    return { txHash };
  }

  @OnQueueFailed()
  async onFailed(job: Job, err: Error) {
    this.logger.error(`Blockchain job ${job.id} failed: ${err.message}`);
    const attempts = (job.opts && (job.opts as any).attempts) || 3;
    if ((job.attemptsMade || 0) >= attempts) {
      await this.dlq.add('failed-job', { origQueue: job.queueName, name: job.name, data: job.data, failedReason: err.message });
    }
  }
}
