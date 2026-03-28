const workerOn = jest.fn();
const workerClose = jest.fn();
const queueEventsClose = jest.fn();
let capturedProcessor:
  | ((job: { data: { targetType: string; targetId: string; content?: string } }) => Promise<unknown>)
  | undefined;

jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation((_name, processor) => {
    capturedProcessor = processor;
    return {
      on: workerOn,
      close: workerClose,
    };
  }),
  QueueEvents: jest.fn().mockImplementation(() => ({
    close: queueEventsClose,
  })),
}));

import { ModerationProcessor } from './moderation.processor';
import { ModerationTargetType } from '../entities/moderation-result.entity';

describe('ModerationProcessor', () => {
  const aiModerationService = {
    handleModerationJob: jest.fn(),
  };
  const redisConnection = {
    quit: jest.fn(),
    disconnect: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    capturedProcessor = undefined;
  });

  it('creates a worker and processes moderation jobs', async () => {
    aiModerationService.handleModerationJob.mockResolvedValue({ id: 'result-id' });
    const processor = new ModerationProcessor(
      aiModerationService as never,
      redisConnection as never,
    );

    processor.onModuleInit();

    expect(capturedProcessor).toBeDefined();
    await capturedProcessor?.({
      data: {
        targetType: ModerationTargetType.MESSAGE,
        targetId: 'message-id',
        content: 'hello world',
      },
    });

    expect(aiModerationService.handleModerationJob).toHaveBeenCalledWith({
      targetType: ModerationTargetType.MESSAGE,
      targetId: 'message-id',
      content: 'hello world',
    });
    expect(workerOn).toHaveBeenCalledWith('failed', expect.any(Function));
  });

  it('closes worker, events, and redis connection on destroy', async () => {
    const processor = new ModerationProcessor(aiModerationService as never, redisConnection as never);

    processor.onModuleInit();
    await processor.onModuleDestroy();

    expect(queueEventsClose).toHaveBeenCalled();
    expect(workerClose).toHaveBeenCalled();
    expect(redisConnection.quit).toHaveBeenCalled();
  });
});
