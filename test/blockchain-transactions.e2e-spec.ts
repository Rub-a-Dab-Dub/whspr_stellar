import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('BlockchainTransactions (e2e)', () => {
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

    // Note: In a real e2e test, you would authenticate here
    // This is a simplified version
    userId = '550e8400-e29b-41d4-a716-446655440000';
    jwtToken = 'mock-jwt-token';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/blockchain/transactions', () => {
    it('should return paginated list of transactions', () => {
      return request(app.getHttpServer())
        .get('/api/blockchain/transactions')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);
    });

    it('should filter transactions by type', () => {
      return request(app.getHttpServer())
        .get('/api/blockchain/transactions?type=transfer')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);
    });

    it('should filter transactions by status', () => {
      return request(app.getHttpServer())
        .get('/api/blockchain/transactions?status=pending')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);
    });

    it('should reject invalid pagination parameters', () => {
      return request(app.getHttpServer())
        .get('/api/blockchain/transactions?page=-1')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(400);
    });
  });

  describe('GET /api/blockchain/transactions/:id', () => {
    it('should return 404 for non-existent transaction', () => {
      const nonExistentId = '550e8400-e29b-41d4-a716-446655440999';
      return request(app.getHttpServer())
        .get(`/api/blockchain/transactions/${nonExistentId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(404);
    });

    it('should reject invalid UUID format', () => {
      return request(app.getHttpServer())
        .get('/api/blockchain/transactions/invalid-id')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(400);
    });
  });

  describe('Authorization', () => {
    it('should reject requests without authentication', () => {
      return request(app.getHttpServer()).get('/api/blockchain/transactions').expect(401);
    });
  });
});
