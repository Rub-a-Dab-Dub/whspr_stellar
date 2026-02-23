import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { User } from '../../user/entities/user.entity';
import { Session } from '../../sessions/entities/session.entity';
import {
  AuditLog,
  AuditAction,
  AuditSeverity,
} from '../entities/audit-log.entity';
import { Transfer } from '../../transfer/entities/transfer.entity';
import { Message } from '../../message/entities/message.entity';
import { Room } from '../../room/entities/room.entity';
import { RoomMember } from '../../room/entities/room-member.entity';
import { RoomPayment } from '../../room/entities/room-payment.entity';
import { PlatformConfig } from '../entities/platform-config.entity';
import { AuditLogService } from './audit-log.service';
import { TransferBalanceService } from '../../transfer/services/transfer-balance.service';
import { RedisService } from '../../redis/redis.service';
import { LeaderboardService } from '../../leaderboard/leaderboard.service';
import { CacheService } from '../../cache/cache.service';

describe('AdminService - Password Reset', () => {
  let service: AdminService;
  let userRepository: Repository<User>;
  let sessionRepository: Repository<Session>;
  let eventEmitter: EventEmitter2;

  const mockUserRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockSessionRepository = {
    update: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 2 }),
    })),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockAuditLogService = {
    createAuditLog: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: getRepositoryToken(AuditLog), useValue: {} },
        { provide: getRepositoryToken(Transfer), useValue: {} },
        {
          provide: getRepositoryToken(Session),
          useValue: mockSessionRepository,
        },
        { provide: getRepositoryToken(Message), useValue: {} },
        { provide: getRepositoryToken(Room), useValue: {} },
        { provide: getRepositoryToken(RoomMember), useValue: {} },
        { provide: getRepositoryToken(RoomPayment), useValue: {} },
        { provide: getRepositoryToken(PlatformConfig), useValue: {} },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: TransferBalanceService, useValue: {} },
        { provide: RedisService, useValue: {} },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: LeaderboardService, useValue: {} },
        { provide: CacheService, useValue: {} },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    sessionRepository = module.get<Repository<Session>>(
      getRepositoryToken(Session),
    );
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('adminResetPassword', () => {
    const userId = 'user-123';
    const adminId = 'admin-456';
    const mockUser = {
      id: userId,
      email: 'user@example.com',
      username: 'testuser',
    };

    it('should generate reset token and invalidate sessions', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.adminResetPassword(userId, adminId);

      expect(result).toEqual({ message: 'Password reset email sent to user' });
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: userId },
      });

      // Verify reset token was set with 1 hour expiry
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          passwordResetToken: expect.any(String),
          passwordResetExpires: expect.any(Date),
        }),
      );

      const updateCall = mockUserRepository.update.mock.calls[0][1];
      const expiryTime = updateCall.passwordResetExpires.getTime();
      const expectedExpiry = Date.now() + 60 * 60 * 1000;
      expect(expiryTime).toBeGreaterThan(Date.now());
      expect(expiryTime).toBeLessThanOrEqual(expectedExpiry + 1000);

      // Verify all sessions were invalidated
      expect(mockSessionRepository.createQueryBuilder).toHaveBeenCalled();

      // Verify event was emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'user.password.reset.admin',
        expect.objectContaining({
          userId,
          email: mockUser.email,
          resetToken: expect.any(String),
        }),
      );

      // Verify audit log
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: adminId,
          action: AuditAction.AUTH_PASSWORD_RESET_REQUESTED,
          targetUserId: userId,
          details: 'Admin triggered password reset',
          metadata: { adminInitiated: true },
          severity: AuditSeverity.HIGH,
        }),
      );
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.adminResetPassword(userId, adminId)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockUserRepository.update).not.toHaveBeenCalled();
      expect(mockSessionRepository.createQueryBuilder).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should not expose reset token in audit log', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.update.mockResolvedValue({ affected: 1 });
      mockSessionRepository.update.mockResolvedValue({ affected: 1 });

      await service.adminResetPassword(userId, adminId);

      const auditCall = mockAuditLogService.createAuditLog.mock.calls[0][0];
      expect(auditCall.metadata).not.toHaveProperty('resetToken');
      expect(auditCall.metadata).not.toHaveProperty('token');
      expect(auditCall.details).not.toContain('token');
    });

    it('should continue if email sending fails', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.update.mockResolvedValue({ affected: 1 });
      mockEventEmitter.emit.mockImplementation(() => {
        throw new Error('Email service unavailable');
      });

      const result = await service.adminResetPassword(userId, adminId);

      expect(result).toEqual({ message: 'Password reset email sent to user' });
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalled();
    });
  });
});
