import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookSubscription } from '../entities/webhook-subscription.entity';
import {
  WebhookDelivery,
  WebhookDeliveryStatus,
} from '../entities/webhook-delivery.entity';
import { User } from '../../user/entities/user.entity';
import { Notification } from '../../notifications/entities/notification.entity';
import { AuditLogService } from './audit-log.service';
import { QUEUE_NAMES } from '../../queue/queue.constants';
import { UserRole } from '../../roles/entities/user-role.enum';
import { WebhookEvent } from '../enums/webhook-event.enum';

const ADMIN_ID = 'admin-uuid-123';

const mockSubscription: Partial<WebhookSubscription> = {
  id: 'sub-uuid-1',
  url: 'https://example.com/hook',
  secret: 'abc123secret',
  events: [WebhookEvent.USER_REGISTERED],
  isActive: true,
  consecutiveFailures: 0,
  createdById: ADMIN_ID,
};

const mockDelivery: Partial<WebhookDelivery> = {
  id: 'del-uuid-1',
  subscriptionId: 'sub-uuid-1',
  event: WebhookEvent.USER_REGISTERED,
  payload: { event: WebhookEvent.USER_REGISTERED, timestamp: '2024-01-01T00:00:00Z', data: {} },
  status: WebhookDeliveryStatus.FAILED,
  attemptCount: 3,
  responseStatus: 500,
  responseBody: 'Internal Server Error',
};

describe('WebhookService', () => {
  let service: WebhookService;
  let subscriptionRepo: any;
  let deliveryRepo: any;
  let userRepo: any;
  let notificationRepo: any;
  let webhookQueue: any;
  let auditLogService: any;

  beforeEach(async () => {
    subscriptionRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };
    deliveryRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    userRepo = {
      find: jest.fn(),
    };
    notificationRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };
    webhookQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };
    auditLogService = {
      createAuditLog: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        { provide: getRepositoryToken(WebhookSubscription), useValue: subscriptionRepo },
        { provide: getRepositoryToken(WebhookDelivery), useValue: deliveryRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Notification), useValue: notificationRepo },
        { provide: getQueueToken(QUEUE_NAMES.WEBHOOK_DELIVERIES), useValue: webhookQueue },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
  });

  // ─── generateSignature ──────────────────────────────────────────────────────

  describe('generateSignature', () => {
    it('returns sha256= prefixed HMAC-SHA256 hex digest', () => {
      const sig = service.generateSignature('{"foo":"bar"}', 'mysecret');
      expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
    });

    it('produces different signatures for different secrets', () => {
      const payload = '{"event":"test"}';
      const sig1 = service.generateSignature(payload, 'secret1');
      const sig2 = service.generateSignature(payload, 'secret2');
      expect(sig1).not.toEqual(sig2);
    });

    it('produces different signatures for different payloads', () => {
      const secret = 'constant-secret';
      const sig1 = service.generateSignature('payload-a', secret);
      const sig2 = service.generateSignature('payload-b', secret);
      expect(sig1).not.toEqual(sig2);
    });

    it('is deterministic for the same input', () => {
      const sig1 = service.generateSignature('data', 'key');
      const sig2 = service.generateSignature('data', 'key');
      expect(sig1).toEqual(sig2);
    });
  });

  // ─── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns all subscriptions ordered by createdAt DESC', async () => {
      subscriptionRepo.find.mockResolvedValue([mockSubscription]);
      const result = await service.findAll();
      expect(result).toEqual([mockSubscription]);
      expect(subscriptionRepo.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
    });
  });

  // ─── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('generates a secret and returns it with the subscription', async () => {
      const saved = { ...mockSubscription, id: 'new-id' };
      subscriptionRepo.create.mockReturnValue(saved);
      subscriptionRepo.save.mockResolvedValue(saved);

      const result = await service.create(
        { url: 'https://example.com/hook', events: [WebhookEvent.USER_REGISTERED] },
        ADMIN_ID,
      );

      expect(result.plainSecret).toBeDefined();
      expect(result.plainSecret).toHaveLength(64); // 32 bytes hex
      expect(auditLogService.createAuditLog).toHaveBeenCalledTimes(1);
    });

    it('sets isActive=true and consecutiveFailures=0 on creation', async () => {
      subscriptionRepo.create.mockImplementation((data) => data);
      subscriptionRepo.save.mockImplementation((data) => Promise.resolve(data));

      const result = await service.create(
        { url: 'https://example.com/hook', events: [WebhookEvent.USER_BANNED] },
        ADMIN_ID,
      );

      expect(result.isActive).toBe(true);
      expect(result.consecutiveFailures).toBe(0);
    });
  });

  // ─── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('throws NotFoundException when subscription not found', async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);
      await expect(
        service.update('bad-id', { isActive: false }, ADMIN_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates only provided fields', async () => {
      const sub = { ...mockSubscription };
      subscriptionRepo.findOne.mockResolvedValue(sub);
      subscriptionRepo.save.mockImplementation((s) => Promise.resolve(s));

      const result = await service.update('sub-uuid-1', { isActive: false }, ADMIN_ID);
      expect(result.isActive).toBe(false);
      expect(result.url).toBe(mockSubscription.url);
    });
  });

  // ─── remove ──────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('throws NotFoundException when subscription not found', async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('bad-id', ADMIN_ID)).rejects.toThrow(NotFoundException);
    });

    it('removes the subscription and logs audit', async () => {
      subscriptionRepo.findOne.mockResolvedValue({ ...mockSubscription });
      subscriptionRepo.remove.mockResolvedValue(undefined);

      await service.remove('sub-uuid-1', ADMIN_ID);
      expect(subscriptionRepo.remove).toHaveBeenCalledTimes(1);
      expect(auditLogService.createAuditLog).toHaveBeenCalledTimes(1);
    });
  });

  // ─── retryDelivery ───────────────────────────────────────────────────────────

  describe('retryDelivery', () => {
    it('throws NotFoundException when delivery not found', async () => {
      deliveryRepo.findOne.mockResolvedValue(null);
      await expect(service.retryDelivery('bad-id', ADMIN_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when delivery is not failed', async () => {
      deliveryRepo.findOne.mockResolvedValue({
        ...mockDelivery,
        status: WebhookDeliveryStatus.DELIVERED,
      });
      await expect(service.retryDelivery('del-uuid-1', ADMIN_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('resets delivery and enqueues a new job', async () => {
      const delivery = { ...mockDelivery, status: WebhookDeliveryStatus.FAILED };
      deliveryRepo.findOne.mockResolvedValue(delivery);
      deliveryRepo.save.mockImplementation((d) => Promise.resolve(d));

      const result = await service.retryDelivery('del-uuid-1', ADMIN_ID);

      expect(result.status).toBe(WebhookDeliveryStatus.PENDING);
      expect(result.attemptCount).toBe(0);
      expect(webhookQueue.add).toHaveBeenCalledWith(
        'deliver-webhook',
        { deliveryId: expect.any(String) },
        expect.objectContaining({ attempts: 3 }),
      );
    });
  });

  // ─── dispatchEvent ──────────────────────────────────────────────────────────

  describe('dispatchEvent', () => {
    it('creates deliveries only for subscriptions subscribed to the event', async () => {
      const subs = [
        { ...mockSubscription, id: 'sub-1', events: [WebhookEvent.USER_REGISTERED] },
        { ...mockSubscription, id: 'sub-2', events: [WebhookEvent.USER_BANNED] },
      ];
      subscriptionRepo.find.mockResolvedValue(subs);
      const savedDelivery = { id: 'del-new', subscriptionId: 'sub-1' };
      deliveryRepo.create.mockReturnValue(savedDelivery);
      deliveryRepo.save.mockResolvedValue(savedDelivery);

      await service.dispatchEvent(WebhookEvent.USER_REGISTERED, { userId: '123' });

      expect(deliveryRepo.create).toHaveBeenCalledTimes(1);
      expect(webhookQueue.add).toHaveBeenCalledTimes(1);
    });

    it('does not create deliveries when no subscriptions match the event', async () => {
      subscriptionRepo.find.mockResolvedValue([
        { ...mockSubscription, events: [WebhookEvent.ROOM_CREATED] },
      ]);

      await service.dispatchEvent(WebhookEvent.USER_REGISTERED, {});

      expect(deliveryRepo.create).not.toHaveBeenCalled();
      expect(webhookQueue.add).not.toHaveBeenCalled();
    });
  });

  // ─── handleDeliveryJobFailed ─────────────────────────────────────────────────

  describe('handleDeliveryJobFailed', () => {
    it('marks delivery as failed', async () => {
      const delivery = {
        ...mockDelivery,
        status: WebhookDeliveryStatus.PENDING,
        subscription: { ...mockSubscription, consecutiveFailures: 0 },
      };
      deliveryRepo.findOne.mockResolvedValue(delivery);
      deliveryRepo.save.mockImplementation((d) => Promise.resolve(d));
      subscriptionRepo.save.mockImplementation((s) => Promise.resolve(s));

      await service.handleDeliveryJobFailed('del-uuid-1');

      expect(delivery.status).toBe(WebhookDeliveryStatus.FAILED);
    });

    it('increments consecutiveFailures on the subscription', async () => {
      const sub = { ...mockSubscription, consecutiveFailures: 2 };
      const delivery = {
        ...mockDelivery,
        subscription: sub,
      };
      deliveryRepo.findOne.mockResolvedValue(delivery);
      deliveryRepo.save.mockImplementation((d) => Promise.resolve(d));
      subscriptionRepo.save.mockImplementation((s) => Promise.resolve(s));

      await service.handleDeliveryJobFailed('del-uuid-1');

      expect(sub.consecutiveFailures).toBe(3);
      expect(sub.isActive).toBe(true);
    });

    it('deactivates subscription and notifies super admins after 5 consecutive failures', async () => {
      const sub = { ...mockSubscription, consecutiveFailures: 4 };
      const delivery = { ...mockDelivery, subscription: sub };
      deliveryRepo.findOne.mockResolvedValue(delivery);
      deliveryRepo.save.mockImplementation((d) => Promise.resolve(d));
      subscriptionRepo.save.mockImplementation((s) => Promise.resolve(s));

      const superAdmin = { id: 'super-1', role: UserRole.SUPER_ADMIN };
      userRepo.find.mockResolvedValue([superAdmin]);
      notificationRepo.create.mockImplementation((n) => n);
      notificationRepo.save.mockResolvedValue([]);

      await service.handleDeliveryJobFailed('del-uuid-1');

      expect(sub.isActive).toBe(false);
      expect(sub.consecutiveFailures).toBe(5);
      expect(notificationRepo.create).toHaveBeenCalledTimes(1);
      expect(notificationRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  // ─── getDeliveries ───────────────────────────────────────────────────────────

  describe('getDeliveries', () => {
    it('throws NotFoundException when subscription not found', async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);
      await expect(
        service.getDeliveries('bad-id', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns paginated deliveries', async () => {
      subscriptionRepo.findOne.mockResolvedValue(mockSubscription);
      deliveryRepo.findAndCount.mockResolvedValue([[mockDelivery], 1]);

      const result = await service.getDeliveries('sub-uuid-1', { page: 1, limit: 10 });

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.page).toBe(1);
    });
  });
});
