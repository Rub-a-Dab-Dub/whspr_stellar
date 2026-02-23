import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BroadcastDeliveryStatsService } from '../services/broadcast-delivery-stats.service';
import { BroadcastNotification } from '../../notifications/entities/broadcast-notification.entity';
import {
  NotificationDelivery,
  DeliveryStatus,
  DeliveryChannel,
} from '../../notifications/entities/notification-delivery.entity';
import { AdminController } from '../controllers/admin.controller';
import { AdminService } from '../services/admin.service';
import { AdminBroadcastService } from '../services/admin-broadcast.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../../roles/guards/role.guard';
import { PermissionGuard } from '../../roles/guards/permission.guard';

describe('Broadcast Delivery Stats (e2e)', () => {
  let app: INestApplication;
  let statsService: BroadcastDeliveryStatsService;
  let deliveryRepository: any;

  const mockBroadcastId = 'broadcast-123';
  const mockBroadcast = {
    id: mockBroadcastId,
    title: 'Test Broadcast',
    body: 'Test message',
    estimatedRecipients: 100,
    status: 'complete',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        BroadcastDeliveryStatsService,
        {
          provide: 'AdminService',
          useValue: {},
        },
        {
          provide: 'AdminBroadcastService',
          useValue: {},
        },
        {
          provide: 'PlatformWalletService',
          useValue: {},
        },
        {
          provide: getRepositoryToken(BroadcastNotification),
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockBroadcast),
          },
        },
        {
          provide: getRepositoryToken(NotificationDelivery),
          useValue: {
            find: jest.fn(),
            update: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
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
    statsService = moduleFixture.get<BroadcastDeliveryStatsService>(
      BroadcastDeliveryStatsService,
    );
    deliveryRepository = moduleFixture.get(
      getRepositoryToken(NotificationDelivery),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /admin/notifications/broadcasts/:broadcastId/stats', () => {
    it('should return broadcast statistics with all required fields', async () => {
      const deliveries = [
        {
          id: '1',
          broadcastId: mockBroadcastId,
          userId: 'user-1',
          channel: DeliveryChannel.IN_APP,
          status: DeliveryStatus.SENT,
          sentAt: new Date(),
          createdAt: new Date(),
        },
        {
          id: '2',
          broadcastId: mockBroadcastId,
          userId: 'user-2',
          channel: DeliveryChannel.EMAIL,
          status: DeliveryStatus.OPENED,
          openedAt: new Date(),
          sentAt: new Date(),
          createdAt: new Date(),
        },
        {
          id: '3',
          broadcastId: mockBroadcastId,
          userId: 'user-3',
          channel: DeliveryChannel.EMAIL,
          status: DeliveryStatus.SENT,
          sentAt: new Date(),
          createdAt: new Date(),
        },
        {
          id: '4',
          broadcastId: mockBroadcastId,
          userId: 'user-4',
          channel: DeliveryChannel.IN_APP,
          status: DeliveryStatus.FAILED,
          failureReason: 'User not found',
          sentAt: new Date(),
          createdAt: new Date(),
        },
      ];

      deliveryRepository.find.mockResolvedValue(deliveries);

      const stats = await statsService.getStats(mockBroadcastId);

      expect(stats).toBeDefined();
      expect(stats.broadcastId).toBe(mockBroadcastId);
      expect(stats.totalTargeted).toBe(100);
      expect(stats.totalSent).toBe(3);
      expect(stats.totalFailed).toBe(1);
      expect(stats.failedUserIds).toContain('user-4');
      expect(stats.emailOpenRate).toBe(0.5); // 1 opened / 2 sent
      expect(stats.byChannel).toBeDefined();
      expect(stats.byChannel.in_app).toBeDefined();
      expect(stats.byChannel.email).toBeDefined();
      expect(stats.timeline).toBeDefined();
    });

    it('should return correct channel breakdown', async () => {
      const deliveries = [
        {
          id: '1',
          broadcastId: mockBroadcastId,
          userId: 'user-1',
          channel: DeliveryChannel.IN_APP,
          status: DeliveryStatus.SENT,
          sentAt: new Date(),
          createdAt: new Date(),
        },
        {
          id: '2',
          broadcastId: mockBroadcastId,
          userId: 'user-2',
          channel: DeliveryChannel.IN_APP,
          status: DeliveryStatus.FAILED,
          failureReason: 'Invalid recipient',
          sentAt: new Date(),
          createdAt: new Date(),
        },
        {
          id: '3',
          broadcastId: mockBroadcastId,
          userId: 'user-3',
          channel: DeliveryChannel.EMAIL,
          status: DeliveryStatus.SENT,
          sentAt: new Date(),
          createdAt: new Date(),
        },
      ];

      deliveryRepository.find.mockResolvedValue(deliveries);

      const stats = await statsService.getStats(mockBroadcastId);

      expect(stats.byChannel.in_app.sent).toBe(1);
      expect(stats.byChannel.in_app.failed).toBe(1);
      expect(stats.byChannel.email.sent).toBe(1);
      expect(stats.byChannel.email.failed).toBe(0);
    });
  });

  describe('GET /admin/notifications/broadcasts/:broadcastId/failed-recipients', () => {
    it('should return CSV of failed user IDs', async () => {
      const deliveries = [
        {
          id: '1',
          broadcastId: mockBroadcastId,
          userId: 'user-failed-1',
          channel: DeliveryChannel.EMAIL,
          status: DeliveryStatus.FAILED,
          createdAt: new Date(),
        },
        {
          id: '2',
          broadcastId: mockBroadcastId,
          userId: 'user-failed-2',
          channel: DeliveryChannel.PUSH,
          status: DeliveryStatus.FAILED,
          createdAt: new Date(),
        },
      ];

      deliveryRepository.find.mockResolvedValue(deliveries);

      const failedIds = await statsService.getFailedRecipients(mockBroadcastId);

      expect(failedIds).toContain('user-failed-1');
      expect(failedIds).toContain('user-failed-2');
      expect(failedIds).toHaveLength(2);
    });

    it('should not include duplicate user IDs', async () => {
      const deliveries = [
        {
          id: '1',
          broadcastId: mockBroadcastId,
          userId: 'user-failed-1',
          channel: DeliveryChannel.EMAIL,
          status: DeliveryStatus.FAILED,
          createdAt: new Date('2025-01-01T10:00:00Z'),
        },
        {
          id: '2',
          broadcastId: mockBroadcastId,
          userId: 'user-failed-1',
          channel: DeliveryChannel.PUSH,
          status: DeliveryStatus.FAILED,
          createdAt: new Date('2025-01-01T10:01:00Z'),
        },
      ];

      deliveryRepository.find.mockResolvedValue(deliveries);

      const failedIds = await statsService.getFailedRecipients(mockBroadcastId);

      expect(failedIds).toEqual(['user-failed-1']);
      expect(failedIds).toHaveLength(1);
    });
  });

  describe('Stats Aggregation Edge Cases', () => {
    it('should handle broadcasts with no deliveries', async () => {
      deliveryRepository.find.mockResolvedValue([]);

      const stats = await statsService.getStats(mockBroadcastId);

      expect(stats.totalSent).toBe(0);
      expect(stats.totalFailed).toBe(0);
      expect(stats.failedUserIds).toHaveLength(0);
      expect(stats.emailOpenRate).toBe(0);
      expect(stats.timeline).toHaveLength(0);
    });

    it('should limit failedUserIds to 100', async () => {
      const deliveries = Array.from({ length: 150 }).map((_, i) => ({
        id: `${i}`,
        broadcastId: mockBroadcastId,
        userId: `user-${i}`,
        channel: DeliveryChannel.EMAIL,
        status: DeliveryStatus.FAILED,
        failureReason: 'Test error',
        sentAt: new Date(),
        createdAt: new Date(),
      }));

      deliveryRepository.find.mockResolvedValue(deliveries);

      const stats = await statsService.getStats(mockBroadcastId);

      expect(stats.failedUserIds).toHaveLength(100);
      expect(stats.failedUserIdsExceeded).toBe(true);
    });

    it('should correctly calculate email open rate', async () => {
      const deliveries = [
        {
          id: '1',
          broadcastId: mockBroadcastId,
          userId: 'user-1',
          channel: DeliveryChannel.EMAIL,
          status: DeliveryStatus.OPENED,
          openedAt: new Date(),
          sentAt: new Date(),
          createdAt: new Date(),
        },
        {
          id: '2',
          broadcastId: mockBroadcastId,
          userId: 'user-2',
          channel: DeliveryChannel.EMAIL,
          status: DeliveryStatus.OPENED,
          openedAt: new Date(),
          sentAt: new Date(),
          createdAt: new Date(),
        },
        {
          id: '3',
          broadcastId: mockBroadcastId,
          userId: 'user-3',
          channel: DeliveryChannel.EMAIL,
          status: DeliveryStatus.SENT,
          sentAt: new Date(),
          createdAt: new Date(),
        },
        {
          id: '4',
          broadcastId: mockBroadcastId,
          userId: 'user-4',
          channel: DeliveryChannel.EMAIL,
          status: DeliveryStatus.FAILED,
          failureReason: 'Bounced',
          sentAt: new Date(),
          createdAt: new Date(),
        },
      ];

      deliveryRepository.find.mockResolvedValue(deliveries);

      const stats = await statsService.getStats(mockBroadcastId);

      // 2 opened / 3 sent (failed ones don't count)
      expect(stats.emailOpenRate).toBe(parseFloat((2 / 3).toFixed(2)));
    });
  });
});
