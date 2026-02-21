// src/admin/auth/admin-auth.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { UserRole } from '../../roles/entities/role.entity';

const mockAdminAuthService = {
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
};

describe('AdminAuthController', () => {
  let controller: AdminAuthController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAuthController],
      providers: [
        { provide: AdminAuthService, useValue: mockAdminAuthService },
      ],
    }).compile();

    controller = module.get<AdminAuthController>(AdminAuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login()', () => {
    it('should call adminAuthService.login with correct params', async () => {
      const loginDto = { email: 'admin@example.com', password: 'password' };
      const expectedResult = {
        access_token: 'token',
        expires_in: 7200,
        admin: { id: 'uuid', email: loginDto.email, role: UserRole.ADMIN },
      };
      mockAdminAuthService.login.mockResolvedValue(expectedResult);
      const req: any = {};

      const result = await controller.login(loginDto, req);

      expect(mockAdminAuthService.login).toHaveBeenCalledWith(
        loginDto.email,
        loginDto.password,
        req,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('refresh()', () => {
    it('should call adminAuthService.refresh with admin user from guard', async () => {
      const mockAdmin = {
        adminId: 'user-uuid-1',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
      };
      const refreshDto = { refreshToken: 'old-refresh-token' };
      const expectedResult = { access_token: 'new-token', expires_in: 7200 };
      mockAdminAuthService.refresh.mockResolvedValue(expectedResult);
      const req: any = {};

      const result = await controller.refresh(refreshDto, mockAdmin, req);

      expect(mockAdminAuthService.refresh).toHaveBeenCalledWith(
        mockAdmin.adminId,
        mockAdmin.email,
        mockAdmin.role,
        req,
      );
      expect(result).toEqual(expectedResult);
    });
  });

  describe('logout()', () => {
    it('should call adminAuthService.logout with admin jti', async () => {
      const mockAdmin = {
        adminId: 'user-uuid-1',
        jti: 'test-jti',
      };
      mockAdminAuthService.logout.mockResolvedValue({
        message: 'Admin logout successful',
      });
      const req: any = {};

      const result = await controller.logout(mockAdmin, req);

      expect(mockAdminAuthService.logout).toHaveBeenCalledWith(
        mockAdmin.adminId,
        mockAdmin.jti,
        req,
      );
      expect(result).toEqual({ message: 'Admin logout successful' });
    });
  });
});
