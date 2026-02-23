import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { WebhookController } from '../src/admin/controllers/webhook.controller';
import { WebhookService } from '../src/admin/services/webhook.service';
import { WebhookSubscription } from '../src/admin/entities/webhook-subscription.entity';
import {
  WebhookDelivery,
  WebhookDeliveryStatus,
} from '../src/admin/entities/webhook-delivery.entity';
import { User } from '../src/user/entities/user.entity';
import { Notification } from '../src/notifications/entities/notification.entity';
import { AuditLogService } from '../src/admin/services/audit-log.service';
import { QUEUE_NAMES } from '../src/queue/queue.constants';
import { RoleGuard } from '../src/roles/guards/role.guard';
import { WebhookEvent } from '../src/admin/enums/webhook-event.enum';

const SUPER_ADMIN_ID = 'super-admin-uuid';

const mockUser = {
  id: SUPER_ADMIN_ID,
  role: 'super_admin',
  roles: [{ name: 'super_admin' }],
};

const mockSubscription = {
  id: 'sub-uuid-1',
  url: 'https://example.com/hook',
  secret: 'stored-secret-never-exposed',
  events: [WebhookEvent.USER_REGISTERED],
  isActive: true,
  consecutiveFailures: 0,
  createdById: SUPER_ADMIN_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Webhook Subscriptions (e2e)', () => {
  let app: INestApplication;
  let webhookService: WebhookService;
  let subscriptionRepo: any;
  let deliveryRepo: any;
  let webhookQueue: any;

  beforeAll(async () => {
    subscriptionRepo = {
      find: jest.fn().mockResolvedValue([mockSubscription]),
      findOne: jest.fn().mockResolvedValue(mockSubscription),
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockImplementation((d) => Promise.resolve({ ...d, id: d.id ?? 'new-id' })),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    deliveryRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockImplementation((d) => Promise.resolve({ ...d, id: d.id ?? 'del-id' })),
    };
    webhookQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        WebhookService,
        { provide: getRepositoryToken(WebhookSubscription), useValue: subscriptionRepo },
        { provide: getRepositoryToken(WebhookDelivery), useValue: deliveryRepo },
        { provide: getRepositoryToken(User), useValue: { find: jest.fn().mockResolvedValue([]) } },
        { provide: getRepositoryToken(Notification), useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: getQueueToken(QUEUE_NAMES.WEBHOOK_DELIVERIES), useValue: webhookQueue },
        { provide: AuditLogService, useValue: { createAuditLog: jest.fn().mockResolvedValue({}) } },
      ],
    })
      .overrideGuard(RoleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );

    // Inject mock user into every request
    app.use((req: any, _res: any, next: any) => {
      req.user = mockUser;
      next();
    });

    webhookService = moduleFixture.get<WebhookService>(WebhookService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── GET /admin/webhooks ─────────────────────────────────────────────────────

  describe('GET /admin/webhooks', () => {
    it('returns list of subscriptions', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/webhooks')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ─── POST /admin/webhooks ────────────────────────────────────────────────────

  describe('POST /admin/webhooks', () => {
    it('creates a subscription and returns the plainSecret once', async () => {
      subscriptionRepo.create.mockImplementation((d) => ({ ...d, id: 'new-sub-id' }));
      subscriptionRepo.save.mockResolvedValue({ ...mockSubscription, id: 'new-sub-id' });

      const res = await request(app.getHttpServer())
        .post('/admin/webhooks')
        .send({ url: 'https://example.com/hook', events: [WebhookEvent.USER_REGISTERED] })
        .expect(201);

      expect(res.body.plainSecret).toBeDefined();
      expect(res.body.plainSecret).toHaveLength(64);
    });

    it('rejects non-HTTPS URLs', async () => {
      await request(app.getHttpServer())
        .post('/admin/webhooks')
        .send({ url: 'http://example.com/hook', events: [WebhookEvent.USER_REGISTERED] })
        .expect(400);
    });

    it('rejects empty events array', async () => {
      await request(app.getHttpServer())
        .post('/admin/webhooks')
        .send({ url: 'https://example.com/hook', events: [] })
        .expect(400);
    });

    it('rejects invalid event names', async () => {
      await request(app.getHttpServer())
        .post('/admin/webhooks')
        .send({ url: 'https://example.com/hook', events: ['not.a.real.event'] })
        .expect(400);
    });
  });

  // ─── PATCH /admin/webhooks/:id ───────────────────────────────────────────────

  describe('PATCH /admin/webhooks/:id', () => {
    it('updates a subscription', async () => {
      subscriptionRepo.findOne.mockResolvedValue({ ...mockSubscription });
      subscriptionRepo.save.mockImplementation((s) => Promise.resolve(s));

      const res = await request(app.getHttpServer())
        .patch('/admin/webhooks/sub-uuid-1')
        .send({ isActive: false })
        .expect(200);

      expect(res.body.isActive).toBe(false);
    });

    it('returns 404 for unknown subscription', async () => {
      subscriptionRepo.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .patch('/admin/webhooks/nonexistent-id')
        .send({ isActive: false })
        .expect(404);
    });
  });

  // ─── DELETE /admin/webhooks/:id ──────────────────────────────────────────────

  describe('DELETE /admin/webhooks/:id', () => {
    it('deletes a subscription and returns 204', async () => {
      subscriptionRepo.findOne.mockResolvedValue({ ...mockSubscription });
      subscriptionRepo.remove.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete('/admin/webhooks/sub-uuid-1')
        .expect(204);
    });
  });

  // ─── POST /admin/webhooks/:id/test ───────────────────────────────────────────

  describe('POST /admin/webhooks/:id/test', () => {
    it('returns response status and body from test ping', async () => {
      subscriptionRepo.findOne.mockResolvedValue({ ...mockSubscription });

      // Mock the HTTP fetch call
      const mockFetch = jest.fn().mockResolvedValue({
        status: 200,
        text: async () => 'OK',
      });
      global.fetch = mockFetch as any;

      const res = await request(app.getHttpServer())
        .post('/admin/webhooks/sub-uuid-1/test')
        .expect(201);

      expect(res.body).toHaveProperty('responseStatus');
      expect(res.body).toHaveProperty('responseBody');
    });
  });

  // ─── GET /admin/webhooks/:id/deliveries ──────────────────────────────────────

  describe('GET /admin/webhooks/:id/deliveries', () => {
    it('returns paginated delivery history', async () => {
      subscriptionRepo.findOne.mockResolvedValue({ ...mockSubscription });
      deliveryRepo.findAndCount.mockResolvedValue([[{ id: 'del-1' }], 1]);

      const res = await request(app.getHttpServer())
        .get('/admin/webhooks/sub-uuid-1/deliveries')
        .expect(200);

      expect(res.body).toMatchObject({
        data: expect.any(Array),
        total: 1,
        page: 1,
        limit: 20,
      });
    });

    it('accepts status filter', async () => {
      subscriptionRepo.findOne.mockResolvedValue({ ...mockSubscription });
      deliveryRepo.findAndCount.mockResolvedValue([[], 0]);

      await request(app.getHttpServer())
        .get('/admin/webhooks/sub-uuid-1/deliveries?status=failed')
        .expect(200);
    });
  });

  // ─── POST /admin/webhooks/deliveries/:id/retry ───────────────────────────────

  describe('POST /admin/webhooks/deliveries/:deliveryId/retry', () => {
    it('returns 400 when delivery is not failed', async () => {
      deliveryRepo.findOne.mockResolvedValue({
        ...mockSubscription,
        id: 'del-1',
        status: WebhookDeliveryStatus.DELIVERED,
      });

      await request(app.getHttpServer())
        .post('/admin/webhooks/deliveries/del-1/retry')
        .expect(400);
    });

    it('enqueues a retry job for a failed delivery', async () => {
      const failedDelivery = {
        id: 'del-1',
        subscriptionId: 'sub-uuid-1',
        event: WebhookEvent.USER_REGISTERED,
        payload: {},
        status: WebhookDeliveryStatus.FAILED,
        attemptCount: 3,
        responseStatus: 500,
        responseBody: 'error',
      };
      deliveryRepo.findOne.mockResolvedValue(failedDelivery);
      deliveryRepo.save.mockImplementation((d) => Promise.resolve(d));

      const res = await request(app.getHttpServer())
        .post('/admin/webhooks/deliveries/del-1/retry')
        .expect(201);

      expect(res.body.status).toBe(WebhookDeliveryStatus.PENDING);
      expect(webhookQueue.add).toHaveBeenCalled();
    });
  });

  // ─── Signature verification ──────────────────────────────────────────────────

  describe('Signature generation', () => {
    it('signs payload with HMAC-SHA256 and prefixes with sha256=', () => {
      const service = app.get(WebhookService);
      const sig = service.generateSignature('{"event":"test"}', 'secret-key');
      expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
    });

    it('different payloads produce different signatures', () => {
      const service = app.get(WebhookService);
      const s1 = service.generateSignature('payload-one', 'same-secret');
      const s2 = service.generateSignature('payload-two', 'same-secret');
      expect(s1).not.toEqual(s2);
    });
  });
});
