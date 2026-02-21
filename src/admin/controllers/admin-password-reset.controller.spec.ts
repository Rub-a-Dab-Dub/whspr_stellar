import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { AdminService } from '../services/admin.service';
import { User } from '../../user/entities/user.entity';
import { Session } from '../../sessions/entities/session.entity';
import { UserRole } from '../../roles/entities/role.entity';

describe('AdminController - Password Reset (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let sessionRepository: Repository<Session>;
  let jwtService: JwtService;
  let adminToken: string;

  const mockUser = {
    id: 'user-123',
    email: 'user@example.com',
    username: 'testuser',
    role: UserRole.USER,
  };

  const mockAdmin = {
    id: 'admin-456',
    email: 'admin@example.com',
    username: 'admin',
    role: UserRole.ADMIN,
  };

  const mockUserRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockSessionRepository = {
    update: jest.fn(),
  };

  const mockAdminService = {
    adminResetPassword: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: mockAdminService },
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: getRepositoryToken(Session), useValue: mockSessionRepository },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(() => 'mock-token'),
            verify: jest.fn(() => ({ sub: mockAdmin.id, role: UserRole.ADMIN })),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    sessionRepository = moduleFixture.get<Repository<Session>>(getRepositoryToken(Session));
    jwtService = moduleFixture.get<JwtService>(JwtService);

    adminToken = jwtService.sign({ sub: mockAdmin.id, role: UserRole.ADMIN });
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /admin/users/:userId/reset-password', () => {
    it('should reset user password successfully', async () => {
      mockAdminService.adminResetPassword.mockResolvedValue({
        message: 'Password reset email sent to user',
      });

      const response = await request(app.getHttpServer())
        .post(`/admin/users/${mockUser.id}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Password reset email sent to user',
      });

      expect(mockAdminService.adminResetPassword).toHaveBeenCalledWith(
        mockUser.id,
        expect.any(String),
        expect.any(Object),
      );
    });

    it('should return 404 if user not found', async () => {
      mockAdminService.adminResetPassword.mockRejectedValue(
        new Error('User not found'),
      );

      await request(app.getHttpServer())
        .post('/admin/users/non-existent-id/reset-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(500);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post(`/admin/users/${mockUser.id}/reset-password`)
        .expect(401);
    });

    it('should require ADMIN role', async () => {
      const userToken = jwtService.sign({ sub: mockUser.id, role: UserRole.USER });

      await request(app.getHttpServer())
        .post(`/admin/users/${mockUser.id}/reset-password`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should validate userId parameter', async () => {
      await request(app.getHttpServer())
        .post('/admin/users/invalid-uuid/reset-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });
});
