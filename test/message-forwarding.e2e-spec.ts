import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('MessageForwarding (e2e)', () => {
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

  describe('POST /api/messages/:id/forward', () => {
    const messageId = '550e8400-e29b-41d4-a716-446655440001';

    it('should successfully forward message to single conversation', () => {
      const forwardDto = {
        targetConversationIds: ['550e8400-e29b-41d4-a716-446655440002'],
      };

      return request(app.getHttpServer())
        .post(`/api/messages/${messageId}/forward`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(forwardDto)
        .expect(201);
    });

    it('should forward to up to 5 target conversations', () => {
      const forwardDto = {
        targetConversationIds: [
          '550e8400-e29b-41d4-a716-446655440002',
          '550e8400-e29b-41d4-a716-446655440003',
          '550e8400-e29b-41d4-a716-446655440004',
          '550e8400-e29b-41d4-a716-446655440005',
          '550e8400-e29b-41d4-a716-446655440006',
        ],
      };

      return request(app.getHttpServer())
        .post(`/api/messages/${messageId}/forward`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(forwardDto)
        .expect(201);
    });

    it('should reject forward to more than 5 conversations', () => {
      const forwardDto = {
        targetConversationIds: [
          '550e8400-e29b-41d4-a716-446655440002',
          '550e8400-e29b-41d4-a716-446655440003',
          '550e8400-e29b-41d4-a716-446655440004',
          '550e8400-e29b-41d4-a716-446655440005',
          '550e8400-e29b-41d4-a716-446655440006',
          '550e8400-e29b-41d4-a716-446655440007',
        ],
      };

      return request(app.getHttpServer())
        .post(`/api/messages/${messageId}/forward`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(forwardDto)
        .expect(400);
    });

    it('should reject empty target list', () => {
      const forwardDto = {
        targetConversationIds: [],
      };

      return request(app.getHttpServer())
        .post(`/api/messages/${messageId}/forward`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(forwardDto)
        .expect(400);
    });

    it('should reject invalid UUID format', () => {
      const forwardDto = {
        targetConversationIds: ['not-a-uuid'],
      };

      return request(app.getHttpServer())
        .post(`/api/messages/${messageId}/forward`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send(forwardDto)
        .expect(400);
    });

    it('should fail without authentication', () => {
      const forwardDto = {
        targetConversationIds: ['550e8400-e29b-41d4-a716-446655440002'],
      };

      return request(app.getHttpServer())
        .post(`/api/messages/${messageId}/forward`)
        .send(forwardDto)
        .expect(401);
    });
  });

  describe('GET /api/messages/:id/forward-chain', () => {
    const messageId = '550e8400-e29b-41d4-a716-446655440001';

    it('should return forward chain', () => {
      return request(app.getHttpServer())
        .get(`/api/messages/${messageId}/forward-chain`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('chain');
          expect(res.body).toHaveProperty('totalDepth');
          expect(Array.isArray(res.body.chain)).toBe(true);
        });
    });

    it('should limit chain depth', () => {
      return request(app.getHttpServer())
        .get(`/api/messages/${messageId}/forward-chain`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200)
        .expect((res) => {
          // Should not exceed depth of 3 beyond original
          expect(res.body.totalDepth).toBeLessThanOrEqual(4);
        });
    });

    it('should handle non-existent message', () => {
      const nonExistentId = '550e8400-e29b-41d4-a716-446655440999';

      return request(app.getHttpServer())
        .get(`/api/messages/${nonExistentId}/forward-chain`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);
    });

    it('should require authentication', () => {
      return request(app.getHttpServer())
        .get(`/api/messages/${messageId}/forward-chain`)
        .expect(401);
    });
  });

  describe('Authorization', () => {
    it('should reject requests without authentication token', () => {
      const forwardDto = {
        targetConversationIds: ['550e8400-e29b-41d4-a716-446655440002'],
      };

      return request(app.getHttpServer())
        .post('/api/messages/550e8400-e29b-41d4-a716-446655440001/forward')
        .send(forwardDto)
        .expect(401);
    });

    it('should reject requests with invalid token', () => {
      const forwardDto = {
        targetConversationIds: ['550e8400-e29b-41d4-a716-446655440002'],
      };

      return request(app.getHttpServer())
        .post('/api/messages/550e8400-e29b-41d4-a716-446655440001/forward')
        .set('Authorization', 'Bearer invalid-token')
        .send(forwardDto)
        .expect(401);
    });
  });
});
