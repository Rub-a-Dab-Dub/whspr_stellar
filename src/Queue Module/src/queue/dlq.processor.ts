import { Injectable, Logger } from '@nestjs/common';
import { Processor, OnQueueFailed } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Injectable()
@Processor('dead-letter')
export class DlqProcessor {
  private readonly logger = new Logger(DlqProcessor.name);

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    this.logger.error(`DLQ received failed job ${job.id}: ${err.message}`);
  }
}
