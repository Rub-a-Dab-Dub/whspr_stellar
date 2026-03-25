import { Test, TestingModule } from '@nestjs/testing';
import { PushNotificationProcessor } from '../processors/push-notification.processor';
import { PushNotificationService } from '../services/push-notification.service';
import { PushJobName } from '../queue/push-queue.constants';
import { Job } from 'bullmq';

const mockDeliverToUser = jest.fn();
const mockDeliverToUsers = jest.fn();
const mockDeliverToTopic = jest.fn();
const mockCleanupTokens = jest.fn();

const mockPushService = {
  deliverToUser: mockDeliverToUser,
  deliverToUsers: mockDeliverToUsers,
  deliverToTopic: mockDeliverToTopic,
  cleanupInvalidTokens: mockCleanupTokens,
};

const makeJob = (name: string, data: Record<string, unknown>, attempts = 0): Job =>
  ({
    id: 'job-test',
    name,
    data,
    attemptsMade: attempts,
    opts: { attempts: 3 },
  } as unknown as Job);

describe('PushNotificationProcessor', () => {
  let processor: PushNotificationProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushNotificationProcessor,
        { provide: PushNotificationService, useValue: mockPushService },
      ],
    }).compile();

    processor = module.get(PushNotificationProcessor);
  });

  describe('process', () => {
    it('should route SEND_TO_USER job to deliverToUser', async () => {
      const payload = { title: 'Hi', body: 'Hello' };
      mockDeliverToUser.mockResolvedValue({ successCount: 1, failureCount: 0, invalidTokens: [] });

      const job = makeJob(PushJobName.SEND_TO_USER, { userId: 'u1', payload, notificationType: 'ALERT' });
      const result = await processor.process(job);

      expect(mockDeliverToUser).toHaveBeenCalledWith('u1', payload, 'ALERT');
      expect(result).toMatchObject({ successCount: 1 });
    });

    it('should throw if SEND_TO_USER job missing userId', async () => {
      const job = makeJob(PushJobName.SEND_TO_USER, { payload: { title: 'x', body: 'y' } });
      await expect(processor.process(job)).rejects.toThrow('userId is required');
    });

    it('should route SEND_TO_USERS job to deliverToUsers', async () => {
      const payload = { title: 'Bulk', body: 'Hello all' };
      mockDeliverToUsers.mockResolvedValue({ successCount: 5, failureCount: 0, invalidTokens: [] });

      const job = makeJob(PushJobName.SEND_TO_USERS, {
        userIds: ['u1', 'u2', 'u3', 'u4', 'u5'],
        payload,
      });
      const result = await processor.process(job);

      expect(mockDeliverToUsers).toHaveBeenCalledWith(['u1', 'u2', 'u3', 'u4', 'u5'], payload, undefined);
      expect(result).toMatchObject({ successCount: 5 });
    });

    it('should throw if SEND_TO_USERS job has empty userIds', async () => {
      const job = makeJob(PushJobName.SEND_TO_USERS, {
        userIds: [],
        payload: { title: 'x', body: 'y' },
      });
      await expect(processor.process(job)).rejects.toThrow('userIds are required');
    });

    it('should route SEND_TO_TOPIC job to deliverToTopic', async () => {
      const payload = { title: 'Topic Msg', body: 'Content' };
      mockDeliverToTopic.mockResolvedValue(undefined);

      const job = makeJob(PushJobName.SEND_TO_TOPIC, { topic: 'news', payload });
      const result = await processor.process(job);

      expect(mockDeliverToTopic).toHaveBeenCalledWith('news', payload);
      expect(result).toMatchObject({ topic: 'news', delivered: true });
    });

    it('should throw if SEND_TO_TOPIC job missing topic', async () => {
      const job = makeJob(PushJobName.SEND_TO_TOPIC, { payload: { title: 'x', body: 'y' } });
      await expect(processor.process(job)).rejects.toThrow('topic is required');
    });

    it('should route CLEANUP job to cleanupInvalidTokens', async () => {
      mockCleanupTokens.mockResolvedValue(2);
      const job = makeJob(PushJobName.CLEANUP_INVALID_TOKENS, { tokens: ['t1', 't2'] });
      const result = await processor.process(job);

      expect(mockCleanupTokens).toHaveBeenCalledWith(['t1', 't2']);
      expect(result).toMatchObject({ removed: 2 });
    });

    it('should return null for unknown job name', async () => {
      const job = makeJob('unknown-job', {});
      const result = await processor.process(job);
      expect(result).toBeNull();
    });
  });

  describe('onFailed', () => {
    it('should log warning on non-final attempt', () => {
      const loggerWarnSpy = jest.spyOn((processor as any).logger, 'warn').mockImplementation();
      const job = makeJob(PushJobName.SEND_TO_USER, {}, 1); // 1 of 3 attempts
      processor.onFailed(job, new Error('transient error'));
      expect(loggerWarnSpy).toHaveBeenCalled();
    });

    it('should log error on final attempt', () => {
      const loggerErrorSpy = jest.spyOn((processor as any).logger, 'error').mockImplementation();
      const job = makeJob(PushJobName.SEND_TO_USER, {}, 3); // 3 of 3 = final
      processor.onFailed(job, new Error('permanent error'));
      expect(loggerErrorSpy).toHaveBeenCalled();
    });
  });
});
