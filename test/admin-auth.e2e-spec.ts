// test/admin-auth.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';

import { AdminAuthController } from '../src/admin/auth/admin-auth.controller';
import { AdminAuthService } from '../src/admin/auth/admin-auth.service';
import { UserRole } from '../src/roles/entities/role.entity';

// ---------------------------------------------------------------------------
// We create a lightweight test application instead of bootstrapping the full
// AppModule (which requires a live DB and Redis connection).
// ---------------------------------------------------------------------------

const mockAdminAuthService = {
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
};

describe('Admin Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AdminAuthController],
      providers: [
        { provide: AdminAuthService, useValue: mockAdminAuthService },
        JwtService,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // POST /admin/auth/login
  // ---------------------------------------------------------------------------

  describe('POST /admin/auth/login', () => {
    it('should return 200 with token on successful login', async () => {
      const loginResponse = {
        access_token: 'eyJ.admin.token',
        expires_in: 7200,
        admin: {
          id: 'uuid-1',
          email: 'admin@example.com',
          role: UserRole.ADMIN,
        },
      };
      mockAdminAuthService.login.mockResolvedValue(loginResponse);

      const response = await request(app.getHttpServer())
        .post('/admin/auth/login')
        .send({ email: 'admin@example.com', password: 'Password123!' })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('expires_in');
      expect(response.body.admin).toMatchObject({
        email: 'admin@example.com',
        role: UserRole.ADMIN,
      });
    });

    it('should return 401 on wrong credentials', async () => {
      const { UnauthorizedException } = await import('@nestjs/common');
      mockAdminAuthService.login.mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );

      await request(app.getHttpServer())
        .post('/admin/auth/login')
        .send({ email: 'admin@example.com', password: 'wrong-password' })
        .expect(401);
    });

    it('should return 403 for non-admin role user', async () => {
      const { ForbiddenException } = await import('@nestjs/common');
      mockAdminAuthService.login.mockRejectedValue(
        new ForbiddenException('Access denied: admin privileges are required'),
      );

      await request(app.getHttpServer())
        .post('/admin/auth/login')
        .send({ email: 'user@example.com', password: 'Password123!' })
        .expect(403);
    });

    it('should return 400 for invalid body (missing password)', async () => {
      await request(app.getHttpServer())
        .post('/admin/auth/login')
        .send({ email: 'admin@example.com' }) // missing password
        .expect(400);
    });

    it('should return 400 for invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/admin/auth/login')
        .send({ email: 'not-an-email', password: 'Password123!' })
        .expect(400);
    });
  });

  // Protected endpoints (refresh/logout) are exercised in test/admin-api.e2e-spec.ts
  // with a dedicated auth harness that models token expiry + refresh lifecycle.
});
