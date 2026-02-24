import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { AdminBroadcastService } from './admin-broadcast.service';
import {
  BroadcastNotification,
  BroadcastStatus,
} from '../../notifications/entities/broadcast-notification.entity';
import { Notification } from '../../notifications/entities/notification.entity';
import { User } from '../../user/entities/user.entity';
import { AuditLogService } from './audit-log.service';
import { BroadcastNotificationDto } from '../dto/broadcast-notification.dto';
import { QUEUE_NAMES } from '../../queue/queue.constants';

describe('AdminBroadcastService', () => {
  let service: AdminBroadcastService;
  let broadcastRepository: any;
  let userRepository: any;
  let notificationQueue: any;
  let auditLogService: any;

  const mockAdmin = { id: 'admin-123', email: 'admin@test.com' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminBroadcastService,
        {
          provide: getRepositoryToken(BroadcastNotification),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Notification),
          useValue: {
            insert: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            count: jest.fn(),
            find: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getQueueToken(QUEUE_NAMES.NOTIFICATIONS),
          useValue: {
            add: jest.fn(),
            getJob: jest.fn(),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            createAuditLog: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AdminBroadcastService>(AdminBroadcastService);
    broadcastRepository = module.get(getRepositoryToken(BroadcastNotification));
    userRepository = module.get(getRepositoryToken(User));
    notificationQueue = module.get(getQueueToken(QUEUE_NAMES.NOTIFICATIONS));
    auditLogService = module.get(AuditLogService);
  });

  describe('broadcast', () => {
    it('should create immediate broadcast', async () => {
      const dto: BroadcastNotificationDto = {
        title: 'Announcement',
        body: 'Test announcement',
        type: 'announcement',
        channels: ['in_app'],
        targetAudience: { scope: 'all' },
      };

      const mockBroadcast = {
        id: 'broadcast-123',
        ...dto,
        createdById: mockAdmin.id,
        estimatedRecipients: 100,
      };

      userRepository.count.mockResolvedValue(100);
      broadcastRepository.create.mockReturnValue(mockBroadcast);
      broadcastRepository.save.mockResolvedValue(mockBroadcast);
      notificationQueue.add.mockResolvedValue({ id: 'job-123' });
      auditLogService.createAuditLog.mockResolvedValue({});

      const result = await service.broadcast(dto, mockAdmin.id);

      expect(result.estimatedRecipients).toBe(100);
      expect(result.jobId).toBe('job-123');
      expect(notificationQueue.add).toHaveBeenCalled();
    });

    it('should schedule delayed broadcast', async () => {
      const dto: BroadcastNotificationDto = {
        title: 'Scheduled Announcement',
        body: 'Future announcement',
        type: 'announcement',
        channels: ['in_app', 'email'],
        targetAudience: { scope: 'all' },
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      };

      userRepository.count.mockResolvedValue(50);
      broadcastRepository.create.mockReturnValue({});
      broadcastRepository.save.mockResolvedValue({ id: 'broadcast-123' });
      notificationQueue.add.mockResolvedValue({ id: 'job-456' });
      auditLogService.createAuditLog.mockResolvedValue({});

      const result = await service.broadcast(dto, mockAdmin.id);

      expect(notificationQueue.add).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ delay: expect.any(Number) }),
      );
    });

    it('should filter by minLevel', async () => {
      const dto: BroadcastNotificationDto = {
        title: 'High Level Quest',
        body: 'For advanced users',
        type: 'reward',
        channels: ['in_app'],
        targetAudience: {
          scope: 'filtered',
          filters: { minLevel: 10 },
        },
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(25),
      };

      userRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      broadcastRepository.create.mockReturnValue({});
      broadcastRepository.save.mockResolvedValue({ id: 'broadcast-123' });
      notificationQueue.add.mockResolvedValue({ id: 'job-789' });
      auditLogService.createAuditLog.mockResolvedValue({});

      const result = await service.broadcast(dto, mockAdmin.id);

      expect(result.estimatedRecipients).toBe(25);
    });
  });

  describe('cancelBroadcast', () => {
    it('should cancel scheduled broadcast', async () => {
      const broadcast = {
        id: 'broadcast-123',
        jobId: 'job-123',
        status: BroadcastStatus.SCHEDULED,
      };

      broadcastRepository.findOne.mockResolvedValue(broadcast);
      notificationQueue.getJob.mockResolvedValue({
        remove: jest.fn(),
      });
      broadcastRepository.save.mockResolvedValue({
        ...broadcast,
        status: BroadcastStatus.CANCELLED,
      });
      auditLogService.createAuditLog.mockResolvedValue({});

      await service.cancelBroadcast('broadcast-123', mockAdmin.id);

      expect(broadcastRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: BroadcastStatus.CANCELLED }),
      );
    });
  });
});
