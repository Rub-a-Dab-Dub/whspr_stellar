import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';

describe('Platform Config (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Create admin user and get token (simplified for test)
    const userRepo = dataSource.getRepository('User');
    const admin = await userRepo.save({
      email: 'test-admin@test.com',
      username: 'testadmin',
      isAdmin: true,
    });

    // Mock JWT token generation - replace with actual auth flow
    adminToken = 'mock-admin-token';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /admin/config', () => {
    it('should return all config entries', () => {
      return request(app.getHttpServer())
        .get('/admin/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
        });
    });

    it('should reject non-admin users', () => {
      return request(app.getHttpServer())
        .get('/admin/config')
        .expect(401);
    });
  });

  describe('PATCH /admin/config/:key', () => {
    it('should update config value', () => {
      return request(app.getHttpServer())
        .patch('/admin/config/xp_multiplier')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 2.0, description: 'Double XP event' })
        .expect(200)
        .expect((res) => {
          expect(res.body.key).toBe('xp_multiplier');
          expect(res.body.value).toBe(2.0);
        });
    });

    it('should invalidate cache after update', async () => {
      await request(app.getHttpServer())
        .patch('/admin/config/platform_fee_percentage')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 3.0 })
        .expect(200);

      // Verify cache was invalidated by fetching again
      const response = await request(app.getHttpServer())
        .get('/admin/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const config = response.body.find(
        (c) => c.key === 'platform_fee_percentage',
      );
      expect(config.value).toBe(3.0);
    });
  });

  describe('GET /admin/config/audit', () => {
    it('should return audit log', () => {
      return request(app.getHttpServer())
        .get('/admin/config/audit')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });
});
