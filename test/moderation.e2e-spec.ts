import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Content Moderation (e2e)', () => {
  let app: INestApplication;
  let userToken: string;
  let adminToken: string;
  let reportId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get user token
    const userLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@test.com', password: 'user123' });
    userToken = userLogin.body.access_token;

    // Get admin token
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@test.com', password: 'admin123' });
    adminToken = adminLogin.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /reports', () => {
    it('should allow authenticated user to submit report', () => {
      return request(app.getHttpServer())
        .post('/reports')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          targetType: 'MESSAGE',
          targetId: 'msg-123',
          reason: 'Inappropriate content',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.status).toBe('PENDING');
          reportId = res.body.id;
        });
    });

    it('should reject unauthenticated requests', () => {
      return request(app.getHttpServer())
        .post('/reports')
        .send({
          targetType: 'USER',
          targetId: 'user-123',
          reason: 'Spam',
        })
        .expect(401);
    });
  });

  describe('GET /admin/reports', () => {
    it('should list reports for admin', () => {
      return request(app.getHttpServer())
        .get('/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('total');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('should filter by status', () => {
      return request(app.getHttpServer())
        .get('/admin/reports?status=PENDING')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should reject non-admin users', () => {
      return request(app.getHttpServer())
        .get('/admin/reports')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('PATCH /admin/reports/:id', () => {
    it('should allow admin to review report', () => {
      return request(app.getHttpServer())
        .patch(`/admin/reports/${reportId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'REVIEWED',
          notes: 'Action taken',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('REVIEWED');
          expect(res.body.reviewedAt).toBeDefined();
        });
    });
  });

  describe('POST /admin/users/:id/ban', () => {
    it('should allow admin to ban user', () => {
      return request(app.getHttpServer())
        .post('/admin/users/user-123/ban')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Repeated violations',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });
    });

    it('should reject non-admin users', () => {
      return request(app.getHttpServer())
        .post('/admin/users/user-123/ban')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reason: 'Test',
        })
        .expect(403);
    });
  });

  describe('POST /admin/rooms/:id/remove', () => {
    it('should allow admin to remove room', () => {
      return request(app.getHttpServer())
        .post('/admin/rooms/room-123/remove')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Violates terms of service',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });
    });
  });
});
