import { Queue } from 'bullmq';
import {
  AI_MODERATION_JOB_NAME,
  HUMAN_MODERATION_JOB_NAME,
  ModerationQueueService,
} from './moderation.queue';
import { ModerationAction, ModerationTargetType } from '../entities/moderation-result.entity';

describe('ModerationQueueService', () => {
  let service: ModerationQueueService;
  let queue: Pick<Queue, 'add' | 'close'>;
  let humanModerationQueue: Pick<Queue, 'add' | 'close'>;

  beforeEach(() => {
    queue = {
      add: jest.fn(),
      close: jest.fn(),
    };
    humanModerationQueue = {
      add: jest.fn(),
      close: jest.fn(),
    };

    service = new ModerationQueueService(
      queue as unknown as Queue,
      humanModerationQueue as unknown as Queue,
    );
  });

  it('enqueues standard moderation jobs', async () => {
    await service.enqueueTextModeration({
      targetType: ModerationTargetType.MESSAGE,
      targetId: 'message-id',
      content: 'hello world',
    });

    expect(queue.add).toHaveBeenCalledWith(
      AI_MODERATION_JOB_NAME,
      expect.objectContaining({
        targetType: ModerationTargetType.MESSAGE,
        targetId: 'message-id',
      }),
      expect.objectContaining({
        priority: 1,
      }),
    );
  });

  it('enqueues image moderation jobs', async () => {
    await service.enqueueImageModeration('user-id', 'https://example.com/image.png');

    expect(queue.add).toHaveBeenCalledWith(
      AI_MODERATION_JOB_NAME,
      expect.objectContaining({
        targetType: ModerationTargetType.IMAGE,
        targetId: 'user-id',
        imageUrl: 'https://example.com/image.png',
      }),
      expect.any(Object),
    );
  });

  it('enqueues human moderation review jobs with deterministic ids', async () => {
    await service.enqueueHumanModerationReview({
      moderationResultId: 'result-id',
      targetType: ModerationTargetType.PROFILE,
      targetId: 'profile-id',
      confidence: 0.82,
      action: ModerationAction.WARN,
      flagged: true,
    });

    expect(humanModerationQueue.add).toHaveBeenCalledWith(
      HUMAN_MODERATION_JOB_NAME,
      expect.objectContaining({
        moderationResultId: 'result-id',
      }),
      expect.objectContaining({
        jobId: 'result-id',
      }),
    );
  });
});
