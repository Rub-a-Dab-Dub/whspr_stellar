import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, QueueEvents, Worker } from 'bullmq';
import Redis from 'ioredis';
import { AIModerationService } from '../services/ai-moderation.service';
import {
  AI_MODERATION_JOB_NAME,
  AI_MODERATION_QUEUE_NAME,
  MODERATION_REDIS,
  ModerationJobPayload,
} from './moderation.queue';

@Injectable()
export class ModerationProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ModerationProcessor.name);
  private worker?: Worker<ModerationJobPayload>;
  private queueEvents?: QueueEvents;

  constructor(
    private readonly aiModerationService: AIModerationService,
    @Inject(MODERATION_REDIS) private readonly connection: Redis,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<ModerationJobPayload>(
      AI_MODERATION_QUEUE_NAME,
      async (job: Job<ModerationJobPayload>) =>
        Promise.race([
          this.aiModerationService.handleModerationJob(job.data),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Moderation processing exceeded 5 seconds')), 5000),
          ),
        ]),
      {
        connection: this.connection,
        concurrency: 5,
      },
    );

    this.queueEvents = new QueueEvents(AI_MODERATION_QUEUE_NAME, {
      connection: this.connection,
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Moderation job failed: ${job?.name ?? AI_MODERATION_JOB_NAME} | error=${error.message}`,
        error.stack,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queueEvents?.close();
    await this.worker?.close();
    try {
      await this.connection.quit();
    } catch {
      await this.connection.disconnect();
    }
  }
}
