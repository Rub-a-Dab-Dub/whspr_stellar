import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { JobsOptions, Queue } from 'bullmq';
import { ModerationTargetType } from '../entities/moderation-result.entity';

export const MODERATION_REDIS = 'MODERATION_REDIS';
export const MODERATION_QUEUE = 'MODERATION_QUEUE';
export const HUMAN_MODERATION_QUEUE = 'HUMAN_MODERATION_QUEUE';
export const AI_MODERATION_QUEUE_NAME = 'ai-moderation';
export const HUMAN_MODERATION_QUEUE_NAME = 'human-moderation-review';
export const AI_MODERATION_JOB_NAME = 'moderate';
export const HUMAN_MODERATION_JOB_NAME = 'review';

export interface ModerationJobPayload {
  targetType: ModerationTargetType;
  targetId: string;
  content?: string;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface HumanModerationJobPayload {
  moderationResultId: string;
  targetType: ModerationTargetType;
  targetId: string;
  confidence: number;
  action: string;
  flagged: boolean;
}

export const moderationQueueFactory = {
  provide: MODERATION_REDIS,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) =>
    new Redis({
      host: configService.get<string>('REDIS_HOST', 'localhost'),
      port: configService.get<number>('REDIS_PORT', 6379),
      password: configService.get<string>('REDIS_PASSWORD') || undefined,
      db: configService.get<number>('REDIS_DB', 0),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    }),
};

export const moderationBullQueueFactory = {
  provide: MODERATION_QUEUE,
  inject: [MODERATION_REDIS],
  useFactory: (connection: Redis) =>
    new Queue<ModerationJobPayload>(AI_MODERATION_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    }),
};

export const humanModerationBullQueueFactory = {
  provide: HUMAN_MODERATION_QUEUE,
  inject: [MODERATION_REDIS],
  useFactory: (connection: Redis) =>
    new Queue<HumanModerationJobPayload>(HUMAN_MODERATION_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    }),
};

@Injectable()
export class ModerationQueueService implements OnModuleDestroy {
  private readonly defaultJobOptions: JobsOptions = {
    jobId: undefined,
    priority: 1,
    delay: 0,
  };

  constructor(
    @Inject(MODERATION_QUEUE) private readonly queue: Queue<ModerationJobPayload>,
    @Inject(HUMAN_MODERATION_QUEUE)
    private readonly humanModerationQueue: Queue<HumanModerationJobPayload>,
  ) {}

  async enqueueTextModeration(payload: ModerationJobPayload): Promise<void> {
    await this.queue.add(AI_MODERATION_JOB_NAME, payload, this.defaultJobOptions);
  }

  async enqueueProfileModeration(targetId: string, content: string): Promise<void> {
    await this.enqueueTextModeration({
      targetType: ModerationTargetType.PROFILE,
      targetId,
      content,
    });
  }

  async enqueueUserModeration(targetId: string, content: string): Promise<void> {
    await this.enqueueTextModeration({
      targetType: ModerationTargetType.USER,
      targetId,
      content,
    });
  }

  async enqueueImageModeration(targetId: string, imageUrl: string): Promise<void> {
    await this.queue.add(
      AI_MODERATION_JOB_NAME,
      {
        targetType: ModerationTargetType.IMAGE,
        targetId,
        imageUrl,
      },
      this.defaultJobOptions,
    );
  }

  async enqueueHumanModerationReview(payload: HumanModerationJobPayload): Promise<void> {
    await this.humanModerationQueue.add(HUMAN_MODERATION_JOB_NAME, payload, {
      ...this.defaultJobOptions,
      jobId: payload.moderationResultId,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.humanModerationQueue.close();
    await this.queue.close();
  }
}
