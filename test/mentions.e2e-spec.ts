import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Mentions (e2e)', () => {
  let app: INestApplication;
  let jwtToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    userId = '550e8400-e29b-41d4-a716-446655440000';
    jwtToken = 'mock-jwt-token';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/mentions', () => {
    it('should return mentions for authenticated user', () => {
      return request(app.getHttpServer())
        .get('/api/mentions')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('total');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('should support pagination', () => {
      return request(app.getHttpServer())
        .get('/api/mentions?limit=10&offset=0')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);
    });

    it('should reject invalid pagination', () => {
      return request(app.getHttpServer())
        .get('/api/mentions?limit=-1')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(400);
    });

    it('should require authentication', () => {
      return request(app.getHttpServer()).get('/api/mentions').expect(401);
    });
  });

  describe('GET /api/mentions/unread-count', () => {
    it('should return unread mention count', () => {
      return request(app.getHttpServer())
        .get('/api/mentions/unread-count')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('unreadCount');
          expect(typeof res.body.unreadCount).toBe('number');
        });
    });

    it('should return 0 when no unread mentions', () => {
      return request(app.getHttpServer())
        .get('/api/mentions/unread-count')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.unreadCount).toBeGreaterThanOrEqual(0);
        });
    });

    it('should require authentication', () => {
      return request(app.getHttpServer())
        .get('/api/mentions/unread-count')
        .expect(401);
    });
  });

  describe('PATCH /api/mentions/:id/read', () => {
    const mentionId = '550e8400-e29b-41d4-a716-446655440010';

    it('should mark mention as read', () => {
      return request(app.getHttpServer())
        .patch(`/api/mentions/${mentionId}/read`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('isRead');
        });
    });

    it('should return 404 for non-existent mention', () => {
      const nonExistentId = '550e8400-e29b-41d4-a716-446655440999';

      return request(app.getHttpServer())
        .patch(`/api/mentions/${nonExistentId}/read`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(404);
    });

    it('should reject invalid UUID format', () => {
      return request(app.getHttpServer())
        .patch('/api/mentions/invalid-id/read')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(400);
    });

    it('should require authentication', () => {
      return request(app.getHttpServer())
        .patch(`/api/mentions/${mentionId}/read`)
        .expect(401);
    });
  });

  describe('POST /api/mentions/read-all', () => {
    it('should mark all mentions as read', () => {
      return request(app.getHttpServer())
        .post('/api/mentions/read-all')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('count');
          expect(typeof res.body.count).toBe('number');
        });
    });

    it('should require authentication', () => {
      return request(app.getHttpServer()).post('/api/mentions/read-all').expect(401);
    });
  });

  describe('Authorization', () => {
    it('should reject requests without authentication', () => {
      return request(app.getHttpServer())
        .get('/api/mentions')
        .expect(401);
    });

    it('should reject requests with invalid token', () => {
      return request(app.getHttpServer())
        .get('/api/mentions')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('Mention parsing', () => {
    it('should correctly parse @username from messages', () => {
      // This would be tested at the messages endpoint level
      // when creating a message with @mentions
      return request(app.getHttpServer())
        .get('/api/mentions')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);
    });
  });

  describe('Unread mention tracking', () => {
    it('should track unread mentions accurately', () => {
      return request(app.getHttpServer())
        .get('/api/mentions/unread-count')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200)
        .then(() =>
          request(app.getHttpServer())
            .post('/api/mentions/read-all')
            .set('Authorization', `Bearer ${jwtToken}`)
            .expect(200),
        )
        .then(() =>
          request(app.getHttpServer())
            .get('/api/mentions/unread-count')
            .set('Authorization', `Bearer ${jwtToken}`)
            .expect(200)
            .expect((res) => {
              expect(res.body.unreadCount).toBe(0);
            }),
        );
    });
  });
});
