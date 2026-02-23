import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { AdminController } from '../controllers/admin.controller';
import { AdminBroadcastService } from '../services/admin-broadcast.service';
import { BroadcastNotificationDto } from '../dto/broadcast-notification.dto';
import { QUEUE_NAMES } from '../../queue/queue.constants';
import { BroadcastNotification } from '../../notifications/entities/broadcast-notification.entity';
import { Notification } from '../../notifications/entities/notification.entity';
import { User } from '../../user/entities/user.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../../roles/guards/role.guard';
import { PermissionGuard } from '../../roles/guards/permission.guard';
import { AuditLogService } from '../services/audit-log.service';

describe('Admin Broadcast Notifications (e2e)', () => {
  let app: INestApplication;
  let broadcastService: AdminBroadcastService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        AdminBroadcastService,
        {
          provide: getRepositoryToken(BroadcastNotification),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn().mockResolvedValue([[], 0]),
          },
        },
        {
          provide: getRepositoryToken(Notification),
          useValue: { insert: jest.fn() },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            count: jest.fn().mockResolvedValue(100),
            find: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getQueueToken(QUEUE_NAMES.NOTIFICATIONS),
          useValue: {
            add: jest.fn().mockResolvedValue({ id: 'job-123' }),
            getJob: jest.fn(),
          },
        },
        {
          provide: AuditLogService,
          useValue: { createAuditLog: jest.fn() },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RoleGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    broadcastService = moduleFixture.get<AdminBroadcastService>(
      AdminBroadcastService,
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /admin/notifications/broadcast', () => {
    it('should create immediate broadcast', async () => {
      const dto: BroadcastNotificationDto = {
        title: 'Announcement',
        body: 'Test notification',
        type: 'announcement',
        channels: ['in_app'],
        targetAudience: { scope: 'all' },
      };

      jest.spyOn(broadcastService, 'broadcast').mockResolvedValue({
        jobId: 'job-123',
        estimatedRecipients: 100,
        scheduledAt: null,
      });

      const response = await request(app.getHttpServer())
        .post('/admin/notifications/broadcast')
        .send(dto)
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(201);
      expect(response.body.jobId).toBe('job-123');
      expect(response.body.estimatedRecipients).toBe(100);
    });

    it('should validate required fields', async () => {
      const invalidDto = {
        title: 'Missing body',
        // missing other required fields
      };

      const response = await request(app.getHttpServer())
        .post('/admin/notifications/broadcast')
        .send(invalidDto)
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(400);
    });
  });

  describe('GET /admin/notifications/broadcasts', () => {
    it('should list broadcasts', async () => {
      jest.spyOn(broadcastService, 'getBroadcasts').mockResolvedValue({
        broadcasts: [],
        total: 0,
      });

      const response = await request(app.getHttpServer())
        .get('/admin/notifications/broadcasts')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('broadcasts');
      expect(response.body).toHaveProperty('total');
    });
  });

  describe('DELETE /admin/notifications/broadcasts/:jobId', () => {
    it('should cancel scheduled broadcast', async () => {
      jest
        .spyOn(broadcastService, 'cancelBroadcast')
        .mockResolvedValue(undefined);

      const response = await request(app.getHttpServer())
        .delete('/admin/notifications/broadcasts/job-123')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(204);
    });
  });
});
