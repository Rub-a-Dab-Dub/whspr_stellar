import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobsOptions, Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { EMAIL_DLQ_NAME, EMAIL_QUEUE_NAME } from './constants';

export interface EmailJobPayload {
  deliveryId: string;
}

@Injectable()
export class EmailQueueService implements OnModuleDestroy {
  private readonly connection: Redis;
  private readonly queue: Queue<EmailJobPayload>;
  private readonly dlq: Queue<EmailJobPayload>;
  private worker: Worker<EmailJobPayload> | null = null;

  constructor(private readonly configService: ConfigService) {
    this.connection = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
      db: this.configService.get<number>('REDIS_DB', 0),
    });

    this.queue = new Queue<EmailJobPayload>(EMAIL_QUEUE_NAME, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    });
    this.dlq = new Queue<EmailJobPayload>(EMAIL_DLQ_NAME, {
      connection: this.connection,
    });
  }

  async enqueue(payload: EmailJobPayload, options?: JobsOptions): Promise<void> {
    await this.queue.add('send-email', payload, options);
  }

  registerWorker(processor: (payload: EmailJobPayload) => Promise<void>): void {
    if (this.worker) {
      return;
    }

    this.worker = new Worker<EmailJobPayload>(
      EMAIL_QUEUE_NAME,
      async (job) => {
        try {
          await processor(job.data);
        } catch (error) {
          if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
            await this.dlq.add('send-email-dlq', job.data);
          }
          throw error;
        }
      },
      { connection: this.connection },
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    await this.queue.close();
    await this.dlq.close();
    await this.connection.quit();
  }
}
