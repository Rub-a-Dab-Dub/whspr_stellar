// src/admin/services/admin-account.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import {
  ForbiddenException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { AdminAccountService } from './admin-account.service';
import { User } from '../../user/entities/user.entity';
import { RedisService } from '../../redis/redis.service';
import { AuditLogService } from './audit-log.service';
import { UserRole } from '../../roles/entities/role.entity';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeAdmin = (overrides: Partial<any> = {}): User =>
  ({
    id: 'admin-uuid-1',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
    isBanned: false,
    bannedAt: null,
    bannedBy: null,
    banReason: null,
    updatedAt: new Date('2026-01-01'),
    createdAt: new Date('2025-01-01'),
    ...overrides,
  }) as unknown as User;

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUserRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
};

const mockRedisService = {
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
};

const mockAuditLogService = {
  createAuditLog: jest.fn().mockResolvedValue(undefined),
};

const mockMailerService = {
  sendMail: jest.fn().mockResolvedValue(undefined),
};

const mockConfigService = {
  get: jest.fn((key: string, fallback?: string) => {
    const config: Record<string, string> = {
      APP_URL: 'https://whspr.test',
      NODE_ENV: 'test',
    };
    return config[key] ?? fallback;
  }),
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('AdminAccountService', () => {
  let service: AdminAccountService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAccountService,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: RedisService, useValue: mockRedisService },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: MailerService, useValue: mockMailerService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AdminAccountService>(AdminAccountService);
  });

  // -------------------------------------------------------------------------
  // listAdmins()
  // -------------------------------------------------------------------------

  describe('listAdmins()', () => {
    it('should return all admin accounts as summaries', async () => {
      const admins = [
        makeAdmin({ id: 'a1', email: 'a1@example.com', role: UserRole.ADMIN }),
        makeAdmin({
          id: 'a2',
          email: 'a2@example.com',
          role: UserRole.SUPER_ADMIN,
        }),
      ];
      mockUserRepository.find.mockResolvedValue(admins);

      const result = await service.listAdmins('actor-id');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'a1',
        role: UserRole.ADMIN,
        isDeactivated: false,
      });
      expect(result[1]).toMatchObject({
        id: 'a2',
        role: UserRole.SUPER_ADMIN,
        isDeactivated: false,
      });
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalledTimes(1);
    });

    it('should mark isBanned=true admins as deactivated', async () => {
      mockUserRepository.find.mockResolvedValue([
        makeAdmin({ isBanned: true }),
      ]);

      const result = await service.listAdmins('actor-id');
      expect(result[0].isDeactivated).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // inviteAdmin()
  // -------------------------------------------------------------------------

  describe('inviteAdmin()', () => {
    it('should store invite token in Redis and return message', async () => {
      mockUserRepository.findOne.mockResolvedValue(null); // email not taken

      const result = await service.inviteAdmin(
        'new@example.com',
        UserRole.ADMIN,
        'actor-id',
      );

      expect(result.message).toContain('Invite sent to new@example.com');
      expect(result.inviteToken).toBeDefined(); // non-production returns token
      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.stringMatching(/^admin:invite:/),
        expect.stringContaining('new@example.com'),
        48 * 3600,
      );
      expect(mockMailerService.sendMail).toHaveBeenCalledTimes(1);
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException if email already registered', async () => {
      mockUserRepository.findOne.mockResolvedValue(
        makeAdmin({ email: 'taken@example.com' }),
      );

      await expect(
        service.inviteAdmin('taken@example.com', UserRole.ADMIN, 'actor-id'),
      ).rejects.toThrow(ConflictException);
    });

    it('should succeed even if email delivery fails', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockMailerService.sendMail.mockRejectedValue(new Error('SMTP timeout'));

      await expect(
        service.inviteAdmin('new@example.com', UserRole.ADMIN, 'actor-id'),
      ).resolves.not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // changeRole()
  // -------------------------------------------------------------------------

  describe('changeRole()', () => {
    it('should throw ForbiddenException when actor tries to demote themselves', async () => {
      await expect(
        service.changeRole('self-id', UserRole.MODERATOR, 'reason', 'self-id'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when target does not exist', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.changeRole(
          'ghost-id',
          UserRole.MODERATOR,
          'reason',
          'actor-id',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when target is not an admin role', async () => {
      mockUserRepository.findOne.mockResolvedValue(
        makeAdmin({ id: 'user-id', role: UserRole.USER }),
      );

      await expect(
        service.changeRole('user-id', UserRole.MODERATOR, 'reason', 'actor-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update role and audit-log on success', async () => {
      const target = makeAdmin({ id: 'target-id', role: UserRole.ADMIN });
      mockUserRepository.findOne.mockResolvedValue(target);
      mockUserRepository.save.mockResolvedValue({
        ...target,
        role: UserRole.MODERATOR,
      });

      const result = await service.changeRole(
        'target-id',
        UserRole.MODERATOR,
        'Adjusting team structure',
        'actor-id',
      );

      expect(result.role).toBe(UserRole.MODERATOR);
      expect(mockUserRepository.save).toHaveBeenCalledTimes(1);
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // deactivateAdmin()
  // -------------------------------------------------------------------------

  describe('deactivateAdmin()', () => {
    it('should throw ForbiddenException when actor tries to deactivate themselves', async () => {
      await expect(
        service.deactivateAdmin('self-id', 'reason', 'self-id'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when target does not exist', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.deactivateAdmin('ghost-id', 'reason', 'actor-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when already deactivated', async () => {
      mockUserRepository.findOne.mockResolvedValue(
        makeAdmin({ isBanned: true }),
      );

      await expect(
        service.deactivateAdmin('target-id', 'reason', 'actor-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should deactivate account, revoke Redis session, and audit-log', async () => {
      const target = makeAdmin({ id: 'target-id', isBanned: false });
      mockUserRepository.findOne.mockResolvedValue(target);
      mockUserRepository.save.mockResolvedValue({ ...target, isBanned: true });

      const result = await service.deactivateAdmin(
        'target-id',
        'Security violation',
        'actor-id',
      );

      expect(result.message).toContain('deactivated');
      expect(mockRedisService.del).toHaveBeenCalledWith(
        'admin:refresh:target-id',
      );
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // reactivateAdmin()
  // -------------------------------------------------------------------------

  describe('reactivateAdmin()', () => {
    it('should throw NotFoundException when target does not exist', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.reactivateAdmin('ghost-id', 'actor-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when account is not deactivated', async () => {
      mockUserRepository.findOne.mockResolvedValue(
        makeAdmin({ isBanned: false }),
      );

      await expect(
        service.reactivateAdmin('target-id', 'actor-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reactivate account and audit-log', async () => {
      const target = makeAdmin({ id: 'target-id', isBanned: true });
      mockUserRepository.findOne.mockResolvedValue(target);
      mockUserRepository.save.mockResolvedValue({ ...target, isBanned: false });

      const result = await service.reactivateAdmin('target-id', 'actor-id');

      expect(result.isDeactivated).toBe(false);
      expect(mockUserRepository.save).toHaveBeenCalledTimes(1);
      expect(mockAuditLogService.createAuditLog).toHaveBeenCalledTimes(1);
    });
  });
});
