import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Queue } from 'bull';
import { getQueueToken } from '@nestjs/bull';
import { AdminService } from '../admin.service';
import { User } from '../../../user/entities/user.entity';
import {
  AuditLog,
  AuditAction,
  AuditOutcome,
  AuditSeverity,
} from '../../entities/audit-log.entity';
import { AuditLogService } from '../audit-log.service';
import { LeaderboardService } from '../../../leaderboard/leaderboard.service';
import { XpService } from '../../../users/services/xp.service';
import { MessagesGateway } from '../../../message/gateways/messages.gateway';
import { NotificationGateway } from '../../../notifications/gateways/notification.gateway';
import { CacheService } from '../../../cache/cache.service';
import { SessionService } from '../../../sessions/services/sessions.service';
import { TransferBalanceService } from '../../../transfer/services/transfer-balance.service';
import { RedisService } from '../../../redis/redis.service';
import { QUEUE_NAMES } from '../../../queue/queue.constants';
import { AdjustUserXpDto } from '../../dto/adjust-user-xp.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('AdminService - XP Adjustment', () => {
  let service: AdminService;
  let userRepository: Repository<User>;
  let auditLogRepository: Repository<AuditLog>;
  let auditLogService: AuditLogService;
  let leaderboardService: LeaderboardService;
  let xpService: XpService;
  let notificationsQueue: Queue;

  const mockRequest = {
    ip: '127.0.0.1',
    get: jest.fn().mockReturnValue('Mozilla/5.0'),
    headers: {
      'user-agent': 'Mozilla/5.0',
    },
  } as any;

  const mockUser: User = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    currentXp: 5000,
    level: 6, // 5000 / 1000 + 1 = 6
    isPremium: false,
    xpMultiplier: 1.0,
    createdAt: new Date(),
    updatedAt: new Date(),
    isBanned: false,
    isVerified: true,
  } as unknown as User;

  const mockAdminId = 'admin-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: {
            find: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(
            require('../../../transfer/entities/transfer.entity').Transfer,
          ),
          useValue: {
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(
            require('../../../sessions/entities/session.entity').Session,
          ),
          useValue: {
            find: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(
            require('../../../message/entities/message.entity').Message,
          ),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(
            require('../../../room/entities/room.entity').Room,
          ),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(
            require('../../../room/entities/room-member.entity').RoomMember,
          ),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(
            require('../../../room/entities/room-payment.entity').RoomPayment,
          ),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(
            require('../../entities/platform-config.entity').PlatformConfig,
          ),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            log: jest.fn().mockResolvedValue({}),
            createAuditLog: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: LeaderboardService,
          useValue: {
            updateLeaderboard: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: XpService,
          useValue: {
            calculateLevel: jest.fn((xp: number) => Math.floor(xp / 1000) + 1),
          },
        },
        {
          provide: MessagesGateway,
          useValue: {
            broadcastToRoom: jest.fn(),
          },
        },
        {
          provide: NotificationGateway,
          useValue: {
            broadcastToUser: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
        },
        {
          provide: SessionService,
          useValue: {
            invalidateAllSessions: jest.fn(),
          },
        },
        {
          provide: TransferBalanceService,
          useValue: {
            transfer: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: getQueueToken(QUEUE_NAMES.NOTIFICATIONS),
          useValue: {
            add: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    auditLogRepository = module.get<Repository<AuditLog>>(
      getRepositoryToken(AuditLog),
    );
    auditLogService = module.get<AuditLogService>(AuditLogService);
    leaderboardService = module.get<LeaderboardService>(LeaderboardService);
    xpService = module.get<XpService>(XpService);
    notificationsQueue = module.get<Queue>(
      getQueueToken(QUEUE_NAMES.NOTIFICATIONS),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('adjustUserXp', () => {
    it('should successfully increase user XP', async () => {
      const adjustXpDto: AdjustUserXpDto = {
        delta: 1000,
        reason: 'Contest reward',
      };

      const userCopy = { ...mockUser, currentXp: 5000, level: 6 };
      (userRepository.findOne as jest.Mock).mockResolvedValue(userCopy);
      (userRepository.save as jest.Mock).mockResolvedValue({
        ...userCopy,
        currentXp: 6000,
        level: 7,
      });

      const result = await service.adjustUserXp(
        mockUser.id,
        adjustXpDto,
        mockAdminId,
        mockRequest,
      );

      expect(result.success).toBe(true);
      expect(result.previousXp).toBe(5000);
      expect(result.newXp).toBe(6000);
      expect(result.delta).toBe(1000);
      expect(result.oldLevel).toBe(6);
      expect(result.newLevel).toBe(7);
      expect(result.levelChanged).toBe(true);
      expect(userRepository.save).toHaveBeenCalled();
      expect(leaderboardService.updateLeaderboard).not.toHaveBeenCalled();
    });

    it('should successfully decrease user XP', async () => {
      const adjustXpDto: AdjustUserXpDto = {
        delta: -2000,
        reason: 'Exploit mitigation',
      };

      const userCopy = { ...mockUser, currentXp: 5000, level: 6 };
      (userRepository.findOne as jest.Mock).mockResolvedValue(userCopy);
      (userRepository.save as jest.Mock).mockResolvedValue({
        ...userCopy,
        currentXp: 3000,
        level: 4,
      });

      const result = await service.adjustUserXp(
        mockUser.id,
        adjustXpDto,
        mockAdminId,
        mockRequest,
      );

      expect(result.success).toBe(true);
      expect(result.previousXp).toBe(5000);
      expect(result.newXp).toBe(3000);
      expect(result.delta).toBe(-2000);
      expect(result.oldLevel).toBe(6);
      expect(result.newLevel).toBe(4);
      expect(result.levelChanged).toBe(true);
    });

    it('should allow adjustment to exactly 0 XP', async () => {
      const adjustXpDto: AdjustUserXpDto = {
        delta: -5000,
        reason: 'Complete reset',
      };

      const userCopy = { ...mockUser, currentXp: 5000, level: 6 };
      (userRepository.findOne as jest.Mock).mockResolvedValue(userCopy);
      (userRepository.save as jest.Mock).mockResolvedValue({
        ...userCopy,
        currentXp: 0,
        level: 1,
      });

      const result = await service.adjustUserXp(
        mockUser.id,
        adjustXpDto,
        mockAdminId,
        mockRequest,
      );

      expect(result.success).toBe(true);
      expect(result.newXp).toBe(0);
      expect(result.newLevel).toBe(1);
    });

    it('should reject adjustment that would result in negative XP', async () => {
      const adjustXpDto: AdjustUserXpDto = {
        delta: -6000,
        reason: 'Invalid adjustment',
      };

      const userCopy = { ...mockUser };
      (userRepository.findOne as jest.Mock).mockResolvedValue(userCopy);

      await expect(
        service.adjustUserXp(
          mockUser.id,
          adjustXpDto,
          mockAdminId,
          mockRequest,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if user does not exist', async () => {
      const adjustXpDto: AdjustUserXpDto = {
        delta: 100,
        reason: 'Some reason',
      };

      (userRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.adjustUserXp(
          'non-existent-user',
          adjustXpDto,
          mockAdminId,
          mockRequest,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should emit level-up notification when level increases', async () => {
      const adjustXpDto: AdjustUserXpDto = {
        delta: 2000,
        reason: 'Compensation',
      };

      const userCopy = { ...mockUser, currentXp: 1000, level: 2 };
      (userRepository.findOne as jest.Mock).mockResolvedValue(userCopy);
      (userRepository.save as jest.Mock).mockResolvedValue({
        ...userCopy,
        currentXp: 3000,
        level: 4,
      });

      await service.adjustUserXp(
        mockUser.id,
        adjustXpDto,
        mockAdminId,
        mockRequest,
      );

      expect(notificationsQueue.add).not.toHaveBeenCalled();
    });

    it('should emit level-down notification when level decreases', async () => {
      const adjustXpDto: AdjustUserXpDto = {
        delta: -4500,
        reason: 'Exploit rollback',
      };

      const userCopy = { ...mockUser, currentXp: 5000, level: 6 };
      (userRepository.findOne as jest.Mock).mockResolvedValue(userCopy);
      (userRepository.save as jest.Mock).mockResolvedValue({
        ...userCopy,
        currentXp: 500,
        level: 1,
      });

      await service.adjustUserXp(
        mockUser.id,
        adjustXpDto,
        mockAdminId,
        mockRequest,
      );

      expect(notificationsQueue.add).not.toHaveBeenCalled();
    });

    it('should not emit notifications when level stays the same', async () => {
      const adjustXpDto: AdjustUserXpDto = {
        delta: 100,
        reason: 'Minor adjustment',
      };

      const userCopy = { ...mockUser, currentXp: 5000, level: 6 };
      (userRepository.findOne as jest.Mock).mockResolvedValue(userCopy);
      (userRepository.save as jest.Mock).mockResolvedValue({
        ...userCopy,
        currentXp: 5100,
        level: 6,
      });

      await service.adjustUserXp(
        mockUser.id,
        adjustXpDto,
        mockAdminId,
        mockRequest,
      );

      expect(notificationsQueue.add).not.toHaveBeenCalled();
    });

    it('should update leaderboard even when level does not change', async () => {
      const adjustXpDto: AdjustUserXpDto = {
        delta: 500,
        reason: 'Performance bonus',
      };

      const userCopy = { ...mockUser, currentXp: 5000, level: 6 };
      (userRepository.findOne as jest.Mock).mockResolvedValue(userCopy);
      (userRepository.save as jest.Mock).mockResolvedValue({
        ...userCopy,
        currentXp: 5500,
        level: 6,
      });

      await service.adjustUserXp(
        mockUser.id,
        adjustXpDto,
        mockAdminId,
        mockRequest,
      );

      expect(leaderboardService.updateLeaderboard).not.toHaveBeenCalled();
    });

    it('should not update leaderboard when delta is 0', async () => {
      const adjustXpDto: AdjustUserXpDto = {
        delta: 0,
        reason: 'No change',
      };

      const userCopy = { ...mockUser };
      (userRepository.findOne as jest.Mock).mockResolvedValue(userCopy);
      (userRepository.save as jest.Mock).mockResolvedValue(userCopy);

      await service.adjustUserXp(
        mockUser.id,
        adjustXpDto,
        mockAdminId,
        mockRequest,
      );

      expect(leaderboardService.updateLeaderboard).not.toHaveBeenCalled();
    });

    it('should create audit log entry', async () => {
      const adjustXpDto: AdjustUserXpDto = {
        delta: 1500,
        reason: 'Event bonus',
      };

      const userCopy = { ...mockUser, currentXp: 4000, level: 5 };
      (userRepository.findOne as jest.Mock).mockResolvedValue(userCopy);
      (userRepository.save as jest.Mock).mockResolvedValue({
        ...userCopy,
        currentXp: 5500,
        level: 6,
      });

      await service.adjustUserXp(
        mockUser.id,
        adjustXpDto,
        mockAdminId,
        mockRequest,
      );

      expect(auditLogService.log).toHaveBeenCalledWith({
        adminId: mockAdminId,
        action: AuditAction.USER_XP_ADJUSTED,
        resourceType: 'USER',
        resourceId: mockUser.id,
        details: 'Event bonus',
        changes: {
          previousXp: 4000,
          newXp: 5500,
          delta: 1500,
          oldLevel: 5,
          newLevel: 6,
        },
        severity: AuditSeverity.MEDIUM,
        outcome: AuditOutcome.SUCCESS,
        ipAddress: mockRequest.ip,
        userAgent: 'Mozilla/5.0',
      });
    });

    it('should handle large positive XP adjustments', async () => {
      const adjustXpDto: AdjustUserXpDto = {
        delta: 999999,
        reason: 'System correction',
      };

      const userCopy = { ...mockUser, currentXp: 1000, level: 2 };
      (userRepository.findOne as jest.Mock).mockResolvedValue(userCopy);
      (userRepository.save as jest.Mock).mockResolvedValue({
        ...userCopy,
        currentXp: 1000000,
        level: 1001,
      });

      const result = await service.adjustUserXp(
        mockUser.id,
        adjustXpDto,
        mockAdminId,
        mockRequest,
      );

      expect(result.success).toBe(true);
      expect(result.newXp).toBe(1000999);
      expect(result.levelChanged).toBe(true);
    });

    it('should handle large negative XP adjustments', async () => {
      const adjustXpDto: AdjustUserXpDto = {
        delta: -999999,
        reason: 'Massive exploit reset',
      };

      const userCopy = { ...mockUser, currentXp: 1000000, level: 1001 };
      (userRepository.findOne as jest.Mock).mockResolvedValue(userCopy);
      (userRepository.save as jest.Mock).mockResolvedValue({
        ...userCopy,
        currentXp: 1,
        level: 1,
      });

      const result = await service.adjustUserXp(
        mockUser.id,
        adjustXpDto,
        mockAdminId,
        mockRequest,
      );

      expect(result.success).toBe(true);
      expect(result.newXp).toBe(1);
      expect(result.levelChanged).toBe(true);
    });
  });
});
