import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Admin Stats API (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Login as admin to get token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@test.com', password: 'admin123' });
    
    adminToken = loginResponse.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /admin/stats/overview', () => {
    it('should return overview stats for admin', () => {
      return request(app.getHttpServer())
        .get('/admin/stats/overview')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('totalUsers');
          expect(res.body).toHaveProperty('dau');
          expect(res.body).toHaveProperty('mau');
          expect(res.body).toHaveProperty('totalRooms');
          expect(res.body).toHaveProperty('transactions24h');
        });
    });

    it('should reject non-admin users', () => {
      return request(app.getHttpServer())
        .get('/admin/stats/overview')
        .expect(401);
    });
  });

  describe('GET /admin/stats/users', () => {
    it('should return user stats with pagination', () => {
      return request(app.getHttpServer())
        .get('/admin/stats/users?period=month&page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('page', 1);
          expect(res.body).toHaveProperty('limit', 10);
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });
  });

  describe('GET /admin/stats/messages', () => {
    it('should return message stats', () => {
      return request(app.getHttpServer())
        .get('/admin/stats/messages')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('total');
        });
    });
  });

  describe('GET /admin/stats/payments', () => {
    it('should return payment stats with volume and fees', () => {
      return request(app.getHttpServer())
        .get('/admin/stats/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(Array.isArray(res.body.data)).toBe(true);
          if (res.body.data.length > 0) {
            expect(res.body.data[0]).toHaveProperty('volume');
            expect(res.body.data[0]).toHaveProperty('fees');
          }
        });
    });
  });

  describe('GET /admin/stats/rooms', () => {
    it('should return room statistics', () => {
      return request(app.getHttpServer())
        .get('/admin/stats/rooms')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('activeRooms');
          expect(res.body).toHaveProperty('newRooms');
          expect(res.body).toHaveProperty('expiredRooms');
        });
    });
  });
});
