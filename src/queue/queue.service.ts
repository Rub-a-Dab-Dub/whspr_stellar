import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { Job } from 'bull';
import { QUEUE_NAMES } from './queue.constants';

export interface JobStatus {
  id: string;
  state: string;
  progress: number;
  data: any;
  failedReason?: string;
  finishedOn?: number;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.WALLET_CREATION)
    private walletCreationQueue: Queue,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    private notificationQueue: Queue,
    @InjectQueue(QUEUE_NAMES.BLOCKCHAIN_TASKS)
    private blockchainTaskQueue: Queue,
  ) {}

  private getQueueMap(): Record<string, Queue> {
    return {
      [QUEUE_NAMES.WALLET_CREATION]: this.walletCreationQueue,
      [QUEUE_NAMES.NOTIFICATIONS]: this.notificationQueue,
      [QUEUE_NAMES.BLOCKCHAIN_TASKS]: this.blockchainTaskQueue,
    };
  }

  private getQueueByName(queueName: string): Queue {
    const queue = this.getQueueMap()[queueName];
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    return queue;
  }

  getQueueNames(): string[] {
    return Object.keys(this.getQueueMap());
  }

  /**
   * Add a wallet creation job to the queue
   */
  async addWalletCreationJob(data: any): Promise<Job> {
    this.logger.log(`Adding wallet creation job: ${JSON.stringify(data)}`);
    return this.walletCreationQueue.add(data, {
      priority: 5,
    });
  }

  /**
   * Add a notification job to the queue
   */
  async addNotificationJob(data: any): Promise<Job> {
    this.logger.log(`Adding notification job: ${JSON.stringify(data)}`);
    return this.notificationQueue.add(data, {
      priority: 3,
    });
  }

  /**
   * Add a blockchain task job to the queue
   */
  async addBlockchainTaskJob(data: any, priority: number = 5): Promise<Job> {
    this.logger.log(`Adding blockchain task job: ${JSON.stringify(data)}`);
    return this.blockchainTaskQueue.add(data, {
      priority,
    });
  }

  /**
   * Get job status by ID
   */
  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    try {
      // Try to find the job in all queues
      const queues = [
        this.walletCreationQueue,
        this.notificationQueue,
        this.blockchainTaskQueue,
      ];

      for (const queue of queues) {
        const job = await queue.getJob(jobId);
        if (job) {
          const state = await job.getState();
          return {
            id: job.id.toString(),
            state,
            progress: job.progress(),
            data: job.data,
            failedReason: job.failedReason,
            finishedOn: job.finishedOn,
          };
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Error getting job status for ${jobId}:`, error);
      return null;
    }
  }

  /**
   * Remove a job from queue
   */
  async removeJob(jobId: string): Promise<void> {
    try {
      const queues = [
        this.walletCreationQueue,
        this.notificationQueue,
        this.blockchainTaskQueue,
      ];

      for (const queue of queues) {
        const job = await queue.getJob(jobId);
        if (job) {
          await job.remove();
          this.logger.log(`Removed job ${jobId}`);
          return;
        }
      }

      this.logger.warn(`Job ${jobId} not found in any queue`);
    } catch (error) {
      this.logger.error(`Error removing job ${jobId}:`, error);
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: string) {
    const queue = this.getQueueByName(queueName);

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      queueName,
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }

  async getAllQueueStats() {
    const queueNames = this.getQueueNames();
    const stats = await Promise.all(
      queueNames.map((queueName) => this.getQueueStats(queueName)),
    );
    return stats;
  }

  async retryFailedJobs(queueName: string, limit = 500) {
    const queue = this.getQueueByName(queueName);
    const failedJobs = await queue.getFailed(0, Math.max(limit - 1, 0));

    let retried = 0;
    const errors: Array<{ jobId: string | number; error: string }> = [];

    for (const job of failedJobs) {
      try {
        await job.retry();
        retried += 1;
      } catch (error) {
        errors.push({
          jobId: job.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      queueName,
      attempted: failedJobs.length,
      retried,
      errors,
      limit,
      hasMore: (await queue.getFailedCount()) > limit,
    };
  }

  async clearFailedJobs(queueName: string) {
    const queue = this.getQueueByName(queueName);
    const before = await queue.getFailedCount();
    const cleanedJobs = await queue.clean(0, 'failed', Number.MAX_SAFE_INTEGER);
    const after = await queue.getFailedCount();

    return {
      queueName,
      failedBefore: before,
      cleared: cleanedJobs.length,
      failedAfter: after,
    };
  }

  // Backward-compatible generic API used in some older services/specs.
  async addJob(name: string, data: any): Promise<Job> {
    return this.notificationQueue.add(name, data);
  }
}
