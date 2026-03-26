import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';

export type NotificationJob = { userId: string; message: string };
export type BlockchainTxJob = { txPayload: any; attempt?: number };
export type MediaJob = { filePath: string; transform: string };
export type EmailJob = { to: string; subject: string; body: string };
export type EventIndexJob = { eventId: string; data: any };

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue('notifications') private notificationsQueue: Queue,
    @InjectQueue('blockchain-tx') private blockchainQueue: Queue,
    @InjectQueue('media-processing') private mediaQueue: Queue,
    @InjectQueue('email') private emailQueue: Queue,
    @InjectQueue('event-indexing') private eventIndexQueue: Queue,
  ) {}

  async enqueueNotification(job: NotificationJob) {
    return this.notificationsQueue.add('send-notification', job, this.baseOpts());
  }

  async enqueueBlockchainTx(job: BlockchainTxJob) {
    return this.blockchainQueue.add('submit-tx', job, this.baseOpts());
  }

  async enqueueMedia(job: MediaJob) {
    return this.mediaQueue.add('process-media', job, this.baseOpts());
  }

  async enqueueEmail(job: EmailJob) {
    return this.emailQueue.add('send-email', job, this.baseOpts());
  }

  async enqueueEventIndex(job: EventIndexJob) {
    return this.eventIndexQueue.add('index-event', job, this.baseOpts());
  }

  private baseOpts() {
    return {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true,
      removeOnFail: false,
      // send failed jobs to DLQ using a separate queue (BullMQ support via job.moveToFailed?)
    } as any;
  }
}
