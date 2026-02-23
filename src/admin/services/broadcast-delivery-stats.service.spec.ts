import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { BroadcastDeliveryStatsService } from './broadcast-delivery-stats.service';
import { BroadcastNotification } from '../../notifications/entities/broadcast-notification.entity';
import {
  NotificationDelivery,
  DeliveryStatus,
  DeliveryChannel,
} from '../../notifications/entities/notification-delivery.entity';

describe('BroadcastDeliveryStatsService', () => {
  let service: BroadcastDeliveryStatsService;
  let broadcastRepository: any;
  let deliveryRepository: any;

  const mockBroadcastId = 'broadcast-123';
  const mockBroadcast = {
    id: mockBroadcastId,
    title: 'Test Broadcast',
    body: 'Test message',
    estimatedRecipients: 100,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BroadcastDeliveryStatsService,
        {
          provide: getRepositoryToken(BroadcastNotification),
          useValue: {
            findOne: jest.fn(),
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
    }).compile();

    service = module.get<BroadcastDeliveryStatsService>(
      BroadcastDeliveryStatsService,
    );
    broadcastRepository = module.get(getRepositoryToken(BroadcastNotification));
    deliveryRepository = module.get(getRepositoryToken(NotificationDelivery));
  });

  describe('getStats', () => {
    it('should throw NotFoundException if broadcast does not exist', async () => {
      broadcastRepository.findOne.mockResolvedValue(null);

      await expect(service.getStats(mockBroadcastId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return correct stats for successful deliveries', async () => {
      broadcastRepository.findOne.mockResolvedValue(mockBroadcast);

      const deliveries = [
        {
          id: '1',
          broadcastId: mockBroadcastId,
          userId: 'user-1',
          channel: DeliveryChannel.IN_APP,
          status: DeliveryStatus.SENT,
          sentAt: new Date('2025-01-01T10:00:00Z'),
          createdAt: new Date('2025-01-01T10:00:00Z'),
        },
        {
          id: '2',
          broadcastId: mockBroadcastId,
          userId: 'user-2',
          channel: DeliveryChannel.IN_APP,
          status: DeliveryStatus.SENT,
          sentAt: new Date('2025-01-01T10:00:30Z'),
          createdAt: new Date('2025-01-01T10:00:00Z'),
        },
        {
          id: '3',
          broadcastId: mockBroadcastId,
          userId: 'user-3',
          channel: DeliveryChannel.IN_APP,
          status: DeliveryStatus.FAILED,
          failureReason: 'Invalid email',
          sentAt: new Date('2025-01-01T10:01:00Z'),
          createdAt: new Date('2025-01-01T10:00:00Z'),
        },
      ];

      deliveryRepository.find.mockResolvedValue(deliveries);

      const stats = await service.getStats(mockBroadcastId);

      expect(stats.broadcastId).toBe(mockBroadcastId);
      expect(stats.totalTargeted).toBe(100);
      expect(stats.totalSent).toBe(2);
      expect(stats.totalFailed).toBe(1);
      expect(stats.failedUserIds).toContain('user-3');
      expect(stats.failedUserIdsExceeded).toBe(false);
    });

    it('should calculate email open rate correctly', async () => {
      broadcastRepository.findOne.mockResolvedValue(mockBroadcast);

      const deliveries = [
        {
          id: '1',
          broadcastId: mockBroadcastId,
          userId: 'user-1',
          channel: DeliveryChannel.EMAIL,
          status: DeliveryStatus.OPENED,
          openedAt: new Date(),
          sentAt: new Date(),
          createdAt: new Date('2025-01-01T10:00:00Z'),
        },
        {
          id: '2',
          broadcastId: mockBroadcastId,
          userId: 'user-2',
          channel: DeliveryChannel.EMAIL,
          status: DeliveryStatus.SENT,
          sentAt: new Date(),
          createdAt: new Date('2025-01-01T10:00:00Z'),
        },
        {
          id: '3',
          broadcastId: mockBroadcastId,
          userId: 'user-3',
          channel: DeliveryChannel.EMAIL,
          status: DeliveryStatus.FAILED,
          failureReason: 'Bounced',
          sentAt: new Date(),
          createdAt: new Date('2025-01-01T10:00:00Z'),
        },
      ];

      deliveryRepository.find.mockResolvedValue(deliveries);

      const stats = await service.getStats(mockBroadcastId);

      expect(stats.emailOpenRate).toBe(0.5); // 1 opened / 2 sent
      expect(stats.byChannel.email.opened).toBe(1);
      expect(stats.byChannel.email.sent).toBe(2);
      expect(stats.byChannel.email.failed).toBe(1);
    });

    it('should limit failedUserIds to 100 and set flag', async () => {
      broadcastRepository.findOne.mockResolvedValue({
        ...mockBroadcast,
        estimatedRecipients: 200,
      });

      const deliveries = Array.from({ length: 150 }).map((_, i) => ({
        id: `${i}`,
        broadcastId: mockBroadcastId,
        userId: `user-${i}`,
        channel: DeliveryChannel.IN_APP,
        status: DeliveryStatus.FAILED,
        failureReason: 'Test error',
        sentAt: new Date(),
        createdAt: new Date('2025-01-01T10:00:00Z'),
      }));

      deliveryRepository.find.mockResolvedValue(deliveries);

      const stats = await service.getStats(mockBroadcastId);

      expect(stats.failedUserIds).toHaveLength(100);
      expect(stats.failedUserIdsExceeded).toBe(true);
    });

    it('should build timeline correctly', async () => {
      broadcastRepository.findOne.mockResolvedValue(mockBroadcast);

      const baseTime = new Date('2025-01-01T10:00:00Z');

      const deliveries = [
        {
          id: '1',
          broadcastId: mockBroadcastId,
          userId: 'user-1',
          channel: DeliveryChannel.IN_APP,
          status: DeliveryStatus.SENT,
          sentAt: new Date(baseTime.getTime() + 0),
          createdAt: baseTime,
        },
        {
          id: '2',
          broadcastId: mockBroadcastId,
          userId: 'user-2',
          channel: DeliveryChannel.IN_APP,
          status: DeliveryStatus.SENT,
          sentAt: new Date(baseTime.getTime() + 30000), // 30 seconds
          createdAt: baseTime,
        },
        {
          id: '3',
          broadcastId: mockBroadcastId,
          userId: 'user-3',
          channel: DeliveryChannel.IN_APP,
          status: DeliveryStatus.SENT,
          sentAt: new Date(baseTime.getTime() + 60000), // 1 minute
          createdAt: baseTime,
        },
        {
          id: '4',
          broadcastId: mockBroadcastId,
          userId: 'user-4',
          channel: DeliveryChannel.IN_APP,
          status: DeliveryStatus.FAILED,
          failureReason: 'Error',
          sentAt: new Date(baseTime.getTime() + 120000),
          createdAt: baseTime,
        },
      ];

      deliveryRepository.find.mockResolvedValue(deliveries);

      const stats = await service.getStats(mockBroadcastId);

      expect(stats.timeline).toBeDefined();
      expect(stats.timeline.length).toBeGreaterThan(0);
      expect(stats.timeline[0].minute).toBe(0);
    });

    it('should aggregate stats by channel correctly', async () => {
      broadcastRepository.findOne.mockResolvedValue(mockBroadcast);

      const deliveries = [
        {
          id: '1',
          broadcastId: mockBroadcastId,
          userId: 'user-1',
          channel: DeliveryChannel.IN_APP,
          status: DeliveryStatus.SENT,
          sentAt: new Date(),
          createdAt: new Date('2025-01-01T10:00:00Z'),
        },
        {
          id: '2',
          broadcastId: mockBroadcastId,
          userId: 'user-2',
          channel: DeliveryChannel.EMAIL,
          status: DeliveryStatus.SENT,
          sentAt: new Date(),
          createdAt: new Date('2025-01-01T10:00:00Z'),
        },
        {
          id: '3',
          broadcastId: mockBroadcastId,
          userId: 'user-3',
          channel: DeliveryChannel.EMAIL,
          status: DeliveryStatus.FAILED,
          failureReason: 'Error',
          sentAt: new Date(),
          createdAt: new Date('2025-01-01T10:00:00Z'),
        },
        {
          id: '4',
          broadcastId: mockBroadcastId,
          userId: 'user-4',
          channel: DeliveryChannel.PUSH,
          status: DeliveryStatus.SENT,
          sentAt: new Date(),
          createdAt: new Date('2025-01-01T10:00:00Z'),
        },
      ];

      deliveryRepository.find.mockResolvedValue(deliveries);

      const stats = await service.getStats(mockBroadcastId);

      expect(stats.byChannel.in_app).toEqual({ sent: 1, failed: 0 });
      expect(stats.byChannel.email).toEqual({ sent: 1, failed: 1 });
      expect(stats.byChannel.push).toEqual({ sent: 1, failed: 0 });
    });
  });

  describe('getFailedRecipients', () => {
    it('should throw NotFoundException if broadcast does not exist', async () => {
      broadcastRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getFailedRecipients(mockBroadcastId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return all failed user IDs', async () => {
      broadcastRepository.findOne.mockResolvedValue(mockBroadcast);

      const deliveries = [
        {
          id: '1',
          broadcastId: mockBroadcastId,
          userId: 'user-1',
          channel: DeliveryChannel.EMAIL,
          status: DeliveryStatus.FAILED,
          createdAt: new Date('2025-01-01T10:00:00Z'),
        },
        {
          id: '2',
          broadcastId: mockBroadcastId,
          userId: 'user-2',
          channel: DeliveryChannel.EMAIL,
          status: DeliveryStatus.FAILED,
          createdAt: new Date('2025-01-01T10:01:00Z'),
        },
      ];

      deliveryRepository.find.mockResolvedValue(deliveries);

      const failedIds = await service.getFailedRecipients(mockBroadcastId);

      expect(failedIds).toEqual(['user-1', 'user-2']);
    });

    it('should return unique user IDs only once', async () => {
      broadcastRepository.findOne.mockResolvedValue(mockBroadcast);

      const deliveries = [
        {
          id: '1',
          broadcastId: mockBroadcastId,
          userId: 'user-1',
          channel: DeliveryChannel.EMAIL,
          status: DeliveryStatus.FAILED,
          createdAt: new Date('2025-01-01T10:00:00Z'),
        },
        {
          id: '2',
          broadcastId: mockBroadcastId,
          userId: 'user-1',
          channel: DeliveryChannel.PUSH,
          status: DeliveryStatus.FAILED,
          createdAt: new Date('2025-01-01T10:01:00Z'),
        },
      ];

      deliveryRepository.find.mockResolvedValue(deliveries);

      const failedIds = await service.getFailedRecipients(mockBroadcastId);

      expect(failedIds).toEqual(['user-1']);
      expect(failedIds).toHaveLength(1);
    });
  });

  describe('recordDelivery', () => {
    it('should create and save a delivery record', async () => {
      const mockDelivery = {
        broadcastId: mockBroadcastId,
        userId: 'user-1',
        channel: DeliveryChannel.IN_APP,
        status: DeliveryStatus.SENT,
        failureReason: null,
        sentAt: expect.any(Date),
      };

      deliveryRepository.create.mockReturnValue(mockDelivery);
      deliveryRepository.save.mockResolvedValue(mockDelivery);

      await service.recordDelivery(
        mockBroadcastId,
        'user-1',
        DeliveryChannel.IN_APP,
        DeliveryStatus.SENT,
      );

      expect(deliveryRepository.create).toHaveBeenCalledWith({
        broadcastId: mockBroadcastId,
        userId: 'user-1',
        channel: DeliveryChannel.IN_APP,
        status: DeliveryStatus.SENT,
        failureReason: undefined,
        sentAt: expect.any(Date),
      });
      expect(deliveryRepository.save).toHaveBeenCalledWith(mockDelivery);
    });

    it('should not set sentAt for pending status', async () => {
      const mockDelivery = {
        broadcastId: mockBroadcastId,
        userId: 'user-1',
        channel: DeliveryChannel.IN_APP,
        status: DeliveryStatus.PENDING,
        failureReason: null,
        sentAt: null,
      };

      deliveryRepository.create.mockReturnValue(mockDelivery);
      deliveryRepository.save.mockResolvedValue(mockDelivery);

      await service.recordDelivery(
        mockBroadcastId,
        'user-1',
        DeliveryChannel.IN_APP,
        DeliveryStatus.PENDING,
      );

      expect(deliveryRepository.create).toHaveBeenCalledWith({
        broadcastId: mockBroadcastId,
        userId: 'user-1',
        channel: DeliveryChannel.IN_APP,
        status: DeliveryStatus.PENDING,
        failureReason: undefined,
        sentAt: null,
      });
    });

    it('should include failure reason for failed deliveries', async () => {
      const failureReason = 'Invalid email address';
      const mockDelivery = {
        broadcastId: mockBroadcastId,
        userId: 'user-1',
        channel: DeliveryChannel.EMAIL,
        status: DeliveryStatus.FAILED,
        failureReason,
        sentAt: expect.any(Date),
      };

      deliveryRepository.create.mockReturnValue(mockDelivery);
      deliveryRepository.save.mockResolvedValue(mockDelivery);

      await service.recordDelivery(
        mockBroadcastId,
        'user-1',
        DeliveryChannel.EMAIL,
        DeliveryStatus.FAILED,
        failureReason,
      );

      expect(deliveryRepository.create).toHaveBeenCalledWith({
        broadcastId: mockBroadcastId,
        userId: 'user-1',
        channel: DeliveryChannel.EMAIL,
        status: DeliveryStatus.FAILED,
        failureReason,
        sentAt: expect.any(Date),
      });
    });
  });

  describe('recordDeliveryOpened', () => {
    it('should update delivery to opened status', async () => {
      await service.recordDeliveryOpened(
        mockBroadcastId,
        'user-1',
        DeliveryChannel.EMAIL,
      );

      expect(deliveryRepository.update).toHaveBeenCalledWith(
        {
          broadcastId: mockBroadcastId,
          userId: 'user-1',
          channel: DeliveryChannel.EMAIL,
        },
        {
          status: DeliveryStatus.OPENED,
          openedAt: expect.any(Date),
        },
      );
    });
  });
});
