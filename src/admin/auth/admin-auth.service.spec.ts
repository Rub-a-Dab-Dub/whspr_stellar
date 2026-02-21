// src/admin/auth/admin-auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

import { AdminAuthService } from './admin-auth.service';
import { UsersService } from '../../user/user.service';
import { RedisService } from '../../redis/redis.service';
import { AuditLogService } from '../services/audit-log.service';
import { UserRole } from '../../roles/entities/role.entity';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeUser = (overrides: Partial<any> = {}) => ({
  id: 'user-uuid-1',
  email: 'admin@example.com',
  password: 'hashed-password',
  role: UserRole.ADMIN,
  roles: [],
  isLocked: false,
  isBanned: false,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUsersService = {
  findByEmail: jest.fn(),
};

const mockJwtService = {
  signAsync: jest.fn().mockResolvedValue('signed-jwt-token'),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const config: Record<string, string> = {
      ADMIN_JWT_SECRET: 'test-admin-secret',
      ADMIN_JWT_REFRESH_SECRET: 'test-admin-refresh-secret',
      ADMIN_JWT_EXPIRES_IN: '2h',
    };
    return config[key];
  }),
};

const mockRedisService = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  exists: jest.fn().mockResolvedValue(false),
  ttl: jest.fn().mockResolvedValue(1500), // 25 minutes remaining
};

const mockAuditLogService = {
  createAuditLog: jest.fn().mockResolvedValue(undefined),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminAuthService', () => {
  let service: AdminAuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    service = module.get<AdminAuthService>(AdminAuthService);
  });

  // -------------------------------------------------------------------------
  // login()
  // -------------------------------------------------------------------------

  describe('login()', () => {
    it('should return access_token and admin info on successful login', async () => {
      const adminUser = makeUser();
      mockUsersService.findByEmail.mockResolvedValue(adminUser);
      mockRedisService.exists.mockResolvedValue(false); // not locked
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login('admin@example.com', 'password');

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('expires_in');
      expect(result.admin).toMatchObject({
        id: adminUser.id,
        email: adminUser.email,
        role: UserRole.ADMIN,
      });
    });

    it('should throw UnauthorizedException for wrong credentials', async () => {
      mockUsersService.findByEmail.mockResolvedValue(makeUser());
      mockRedisService.exists.mockResolvedValue(false);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login('admin@example.com', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockRedisService.exists.mockResolvedValue(false);

      await expect(
        service.login('nonexistent@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException when user has non-admin role', async () => {
      const regularUser = makeUser({ role: UserRole.USER });
      mockUsersService.findByEmail.mockResolvedValue(regularUser);
      mockRedisService.exists.mockResolvedValue(false);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.login('user@example.com', 'password'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw UnauthorizedException when account is locked', async () => {
      mockRedisService.exists.mockResolvedValue(true); // locked
      mockRedisService.ttl.mockResolvedValue(900); // 15 minutes

      await expect(
        service.login('admin@example.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should lock account after 5 failed attempts', async () => {
      const adminUser = makeUser();
      mockUsersService.findByEmail.mockResolvedValue(adminUser);
      mockRedisService.exists.mockResolvedValue(false);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Simulate that attempts key already has count of 4
      mockRedisService.get.mockResolvedValue('4');

      await expect(
        service.login('admin@example.com', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);

      // Lock key should have been set
      expect(mockRedisService.set).toHaveBeenCalledWith(
        `admin:login:locked:admin@example.com`,
        '1',
        30 * 60,
      );
    });

    it('should accept SUPER_ADMIN role', async () => {
      const superAdminUser = makeUser({ role: UserRole.SUPER_ADMIN });
      mockUsersService.findByEmail.mockResolvedValue(superAdminUser);
      mockRedisService.exists.mockResolvedValue(false);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login('superadmin@example.com', 'password');
      expect(result.admin.role).toBe(UserRole.SUPER_ADMIN);
    });

    it('should accept MODERATOR role', async () => {
      const moderatorUser = makeUser({ role: UserRole.MODERATOR });
      mockUsersService.findByEmail.mockResolvedValue(moderatorUser);
      mockRedisService.exists.mockResolvedValue(false);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login('moderator@example.com', 'password');
      expect(result.admin.role).toBe(UserRole.MODERATOR);
    });
  });

  // -------------------------------------------------------------------------
  // refresh()
  // -------------------------------------------------------------------------

  describe('refresh()', () => {
    it('should return a new access token for valid refresh', async () => {
      const result = await service.refresh(
        'user-uuid-1',
        'admin@example.com',
        UserRole.ADMIN,
      );

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('expires_in');
    });

    it('should call generateAdminTokens with correct arguments', async () => {
      const spy = jest.spyOn(service, 'generateAdminTokens');
      await service.refresh('user-uuid-1', 'admin@example.com', UserRole.ADMIN);
      expect(spy).toHaveBeenCalledWith(
        'user-uuid-1',
        'admin@example.com',
        UserRole.ADMIN,
      );
    });
  });

  // -------------------------------------------------------------------------
  // logout()
  // -------------------------------------------------------------------------

  describe('logout()', () => {
    it('should blacklist the access token and delete refresh token', async () => {
      const result = await service.logout('user-uuid-1', 'test-jti');

      expect(mockRedisService.set).toHaveBeenCalledWith(
        'admin:blacklist:test-jti',
        '1',
        expect.any(Number),
      );
      expect(mockRedisService.del).toHaveBeenCalledWith(
        'admin:refresh:user-uuid-1',
      );
      expect(result).toEqual({ message: 'Admin logout successful' });
    });
  });
});
