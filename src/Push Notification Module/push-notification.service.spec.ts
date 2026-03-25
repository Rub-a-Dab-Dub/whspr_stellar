import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException } from '@nestjs/common';
import { PushNotificationService } from '../services/push-notification.service';
import { PushSubscriptionsRepository } from '../repositories/push-subscriptions.repository';
import { NotificationPayloadBuilder } from '../builders/notification-payload.builder';
import { FIREBASE_ADMIN } from '../firebase/firebase-admin.provider';
import { Platform, PushSubscription } from '../entities/push-subscription.entity';
import { PUSH_NOTIFICATION_QUEUE, PushJobName } from '../queue/push-queue.constants';
import { NotificationPayload } from '../interfaces/push-notification.interface';

// ─── Mock Factories ──────────────────────────────────────────────────────────

const makeSub = (overrides: Partial<PushSubscription> = {}): PushSubscription =>
  ({
    id: 'sub-1',
    userId: 'user-1',
    deviceToken: 'token-abc',
    platform: Platform.FCM,
    isActive: true,
    lastUsedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as PushSubscription);

const mockPayload: NotificationPayload = {
  title: 'Test Title',
  body: 'Test Body',
  data: { key: 'value' },
};

// ─── Mock Messaging ──────────────────────────────────────────────────────────

const mockSendEachForMulticast = jest.fn();
const mockSendMessage = jest.fn();
const mockMessaging = jest.fn(() => ({
  sendEachForMulticast: mockSendEachForMulticast,
  send: mockSendMessage,
}));

const mockFirebaseApp = { messaging: mockMessaging };

// ─── Mock Queue ──────────────────────────────────────────────────────────────

const mockQueueAdd = jest.fn();
const mockQueue = { add: mockQueueAdd };

// ─── Mock Repository ─────────────────────────────────────────────────────────

const mockRepo: jest.Mocked<PushSubscriptionsRepository> = {
  findById: jest.fn(),
  findByUserIdAndToken: jest.fn(),
  findActiveByUserId: jest.fn(),
  findActiveByUserIds: jest.fn(),
  findByToken: jest.fn(),
  upsert: jest.fn(),
  deactivateByToken: jest.fn(),
  deactivateByUserIdAndToken: jest.fn(),
  removeInvalidTokens: jest.fn(),
  updateLastUsed: jest.fn(),
  countActiveByUserId: jest.fn(),
  findAll: jest.fn(),
} as any;

// ─── Mock Payload Builder ────────────────────────────────────────────────────

const mockMulticastMessage = { tokens: ['token-abc'], notification: {} };
const mockTopicMessage = { topic: 'news', notification: {} };
const mockBuilder: jest.Mocked<NotificationPayloadBuilder> = {
  buildFcmMessage: jest.fn(),
  buildTopicMessage: jest.fn().mockReturnValue(mockTopicMessage),
  buildMulticastMessage: jest.fn().mockReturnValue(mockMulticastMessage),
} as any;

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('PushNotificationService', () => {
  let service: PushNotificationService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushNotificationService,
        { provide: PushSubscriptionsRepository, useValue: mockRepo },
        { provide: NotificationPayloadBuilder, useValue: mockBuilder },
        { provide: getQueueToken(PUSH_NOTIFICATION_QUEUE), useValue: mockQueue },
        { provide: FIREBASE_ADMIN, useValue: mockFirebaseApp },
      ],
    }).compile();

    service = module.get(PushNotificationService);
  });

  // ── registerDevice ─────────────────────────────────────────────────────────

  describe('registerDevice', () => {
    it('should register a new device and return isNew=true', async () => {
      const sub = makeSub();
      mockRepo.upsert.mockResolvedValue({ subscription: sub, isNew: true });

      const result = await service.registerDevice('user-1', 'token-abc', Platform.FCM);

      expect(mockRepo.upsert).toHaveBeenCalledWith('user-1', 'token-abc', Platform.FCM);
      expect(result.isNew).toBe(true);
      expect(result.subscriptionId).toBe('sub-1');
      expect(result.platform).toBe(Platform.FCM);
    });

    it('should reactivate an existing device and return isNew=false', async () => {
      const sub = makeSub();
      mockRepo.upsert.mockResolvedValue({ subscription: sub, isNew: false });

      const result = await service.registerDevice('user-1', 'token-abc', Platform.FCM);

      expect(result.isNew).toBe(false);
    });

    it('should handle APNS platform', async () => {
      const sub = makeSub({ platform: Platform.APNS });
      mockRepo.upsert.mockResolvedValue({ subscription: sub, isNew: true });

      const result = await service.registerDevice('user-1', 'apns-token', Platform.APNS);
      expect(result.platform).toBe(Platform.APNS);
    });

    it('should handle WEB platform', async () => {
      const sub = makeSub({ platform: Platform.WEB });
      mockRepo.upsert.mockResolvedValue({ subscription: sub, isNew: true });

      const result = await service.registerDevice('user-1', 'web-token', Platform.WEB);
      expect(result.platform).toBe(Platform.WEB);
    });
  });

  // ── unregisterDevice ───────────────────────────────────────────────────────

  describe('unregisterDevice', () => {
    it('should deactivate an existing subscription', async () => {
      mockRepo.findByUserIdAndToken.mockResolvedValue(makeSub());
      mockRepo.deactivateByUserIdAndToken.mockResolvedValue(undefined);

      await service.unregisterDevice('user-1', 'token-abc');

      expect(mockRepo.deactivateByUserIdAndToken).toHaveBeenCalledWith('user-1', 'token-abc');
    });

    it('should throw NotFoundException if subscription does not exist', async () => {
      mockRepo.findByUserIdAndToken.mockResolvedValue(null);

      await expect(
        service.unregisterDevice('user-1', 'unknown-token'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── sendToUser (queue) ─────────────────────────────────────────────────────

  describe('sendToUser', () => {
    it('should enqueue a SEND_TO_USER job', async () => {
      mockQueueAdd.mockResolvedValue({ id: 'job-1' });

      await service.sendToUser('user-1', mockPayload, 'ALERT');

      expect(mockQueueAdd).toHaveBeenCalledWith(
        PushJobName.SEND_TO_USER,
        expect.objectContaining({ userId: 'user-1', payload: mockPayload }),
        expect.any(Object),
      );
    });

    it('should enqueue with notificationType', async () => {
      mockQueueAdd.mockResolvedValue({ id: 'job-2' });

      await service.sendToUser('user-1', mockPayload, 'MESSAGE');

      expect(mockQueueAdd).toHaveBeenCalledWith(
        PushJobName.SEND_TO_USER,
        expect.objectContaining({ notificationType: 'MESSAGE' }),
        expect.any(Object),
      );
    });
  });

  // ── sendToUsers (queue) ────────────────────────────────────────────────────

  describe('sendToUsers', () => {
    it('should enqueue a SEND_TO_USERS job', async () => {
      mockQueueAdd.mockResolvedValue({ id: 'job-3' });

      await service.sendToUsers(['user-1', 'user-2'], mockPayload);

      expect(mockQueueAdd).toHaveBeenCalledWith(
        PushJobName.SEND_TO_USERS,
        expect.objectContaining({ userIds: ['user-1', 'user-2'] }),
        expect.any(Object),
      );
    });
  });

  // ── sendToTopic (queue) ────────────────────────────────────────────────────

  describe('sendToTopic', () => {
    it('should enqueue a SEND_TO_TOPIC job', async () => {
      mockQueueAdd.mockResolvedValue({ id: 'job-4' });

      await service.sendToTopic('news', mockPayload);

      expect(mockQueueAdd).toHaveBeenCalledWith(
        PushJobName.SEND_TO_TOPIC,
        expect.objectContaining({ topic: 'news', payload: mockPayload }),
        expect.any(Object),
      );
    });
  });

  // ── deliverToUser ──────────────────────────────────────────────────────────

  describe('deliverToUser', () => {
    it('should return empty result if no active subscriptions', async () => {
      mockRepo.findActiveByUserId.mockResolvedValue([]);

      const result = await service.deliverToUser('user-1', mockPayload);

      expect(result).toEqual({ successCount: 0, failureCount: 0, invalidTokens: [] });
      expect(mockSendEachForMulticast).not.toHaveBeenCalled();
    });

    it('should send multicast and return success counts', async () => {
      const subs = [makeSub({ id: 's1', deviceToken: 'token-1' })];
      mockRepo.findActiveByUserId.mockResolvedValue(subs);
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      });
      mockRepo.removeInvalidTokens.mockResolvedValue(0);
      mockRepo.updateLastUsed.mockResolvedValue(undefined);

      const result = await service.deliverToUser('user-1', mockPayload);

      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(0);
      expect(result.invalidTokens).toHaveLength(0);
    });

    it('should remove invalid/expired tokens from DB', async () => {
      const subs = [
        makeSub({ id: 's1', deviceToken: 'valid-token' }),
        makeSub({ id: 's2', deviceToken: 'expired-token' }),
      ];
      mockRepo.findActiveByUserId.mockResolvedValue(subs);
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 1,
        failureCount: 1,
        responses: [
          { success: true },
          {
            success: false,
            error: { code: 'messaging/registration-token-not-registered', message: 'expired' },
          },
        ],
      });
      mockRepo.removeInvalidTokens.mockResolvedValue(1);
      mockRepo.updateLastUsed.mockResolvedValue(undefined);

      const result = await service.deliverToUser('user-1', mockPayload);

      expect(result.invalidTokens).toContain('expired-token');
      expect(mockRepo.removeInvalidTokens).toHaveBeenCalledWith(['expired-token']);
    });

    it('should NOT remove tokens with non-expiry FCM errors', async () => {
      const subs = [makeSub({ id: 's1', deviceToken: 'token-1' })];
      mockRepo.findActiveByUserId.mockResolvedValue(subs);
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 0,
        failureCount: 1,
        responses: [
          {
            success: false,
            error: { code: 'messaging/internal-error', message: 'server error' },
          },
        ],
      });
      mockRepo.removeInvalidTokens.mockResolvedValue(0);
      mockRepo.updateLastUsed.mockResolvedValue(undefined);

      const result = await service.deliverToUser('user-1', mockPayload);

      expect(result.invalidTokens).toHaveLength(0);
      expect(mockRepo.removeInvalidTokens).toHaveBeenCalledWith([]);
    });

    it('should handle FCM multicast throwing and re-throw', async () => {
      const subs = [makeSub()];
      mockRepo.findActiveByUserId.mockResolvedValue(subs);
      mockSendEachForMulticast.mockRejectedValue(new Error('FCM network error'));

      await expect(service.deliverToUser('user-1', mockPayload)).rejects.toThrow(
        'FCM network error',
      );
    });
  });

  // ── deliverToUsers ─────────────────────────────────────────────────────────

  describe('deliverToUsers', () => {
    it('should return empty result for empty userIds array', async () => {
      mockRepo.findActiveByUserIds.mockResolvedValue([]);

      const result = await service.deliverToUsers([], mockPayload);
      expect(result).toEqual({ successCount: 0, failureCount: 0, invalidTokens: [] });
    });

    it('should aggregate results across multiple users', async () => {
      const subs = [
        makeSub({ id: 's1', userId: 'user-1', deviceToken: 't1' }),
        makeSub({ id: 's2', userId: 'user-2', deviceToken: 't2' }),
      ];
      mockRepo.findActiveByUserIds.mockResolvedValue(subs);
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 2,
        failureCount: 0,
        responses: [{ success: true }, { success: true }],
      });
      mockRepo.removeInvalidTokens.mockResolvedValue(0);
      mockRepo.updateLastUsed.mockResolvedValue(undefined);

      const result = await service.deliverToUsers(['user-1', 'user-2'], mockPayload);
      expect(result.successCount).toBe(2);
    });
  });

  // ── deliverToTopic ─────────────────────────────────────────────────────────

  describe('deliverToTopic', () => {
    it('should call firebase send with topic message', async () => {
      mockSendMessage.mockResolvedValue('projects/x/messages/123');

      await service.deliverToTopic('news', mockPayload);

      expect(mockBuilder.buildTopicMessage).toHaveBeenCalledWith('news', mockPayload);
      expect(mockSendMessage).toHaveBeenCalledWith(mockTopicMessage);
    });

    it('should re-throw FCM errors', async () => {
      mockSendMessage.mockRejectedValue(new Error('Topic send failed'));

      await expect(service.deliverToTopic('news', mockPayload)).rejects.toThrow(
        'Topic send failed',
      );
    });
  });

  // ── getUserSubscriptions ───────────────────────────────────────────────────

  describe('getUserSubscriptions', () => {
    it('should return all subscriptions for a user', async () => {
      const subs = [makeSub(), makeSub({ id: 'sub-2', deviceToken: 'token-xyz' })];
      mockRepo.findAll.mockResolvedValue(subs);

      const result = await service.getUserSubscriptions('user-1');
      expect(result).toHaveLength(2);
    });
  });

  // ── cleanupInvalidTokens ───────────────────────────────────────────────────

  describe('cleanupInvalidTokens', () => {
    it('should delegate to repository and return removed count', async () => {
      mockRepo.removeInvalidTokens.mockResolvedValue(3);

      const count = await service.cleanupInvalidTokens(['t1', 't2', 't3']);
      expect(count).toBe(3);
      expect(mockRepo.removeInvalidTokens).toHaveBeenCalledWith(['t1', 't2', 't3']);
    });
  });
});
