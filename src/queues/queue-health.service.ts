import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from './queues.module';

@Injectable()
export class QueueHealthService {
  private readonly queues: Queue[];

  constructor(
    @InjectQueue(QUEUE_NAMES.TX_VERIFICATION) txVerification: Queue,
    @InjectQueue(QUEUE_NAMES.WALLET_CREATION) walletCreation: Queue,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) notifications: Queue,
    @InjectQueue(QUEUE_NAMES.ANALYTICS) analytics: Queue,
    @InjectQueue(QUEUE_NAMES.ROOM_EXPIRY) roomExpiry: Queue,
  ) {
    this.queues = [txVerification, walletCreation, notifications, analytics, roomExpiry];
  }

  async getQueueDepths(): Promise<Record<string, { waiting: number; active: number; failed: number }>> {
    const result: Record<string, { waiting: number; active: number; failed: number }> = {};

    await Promise.all(
      this.queues.map(async (queue) => {
        const [waiting, active, failed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getFailedCount(),
        ]);
        result[queue.name] = { waiting, active, failed };
      }),
    );

    return result;
  }
}
