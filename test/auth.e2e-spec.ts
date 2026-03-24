import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { AuthChallenge } from '../src/auth/entities/auth-challenge.entity';
import { RefreshToken } from '../src/auth/entities/refresh-token.entity';
import { AuthAttempt } from '../src/auth/entities/auth-attempt.entity';
import { User } from '../src/users/entities/user.entity';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const WALLET = 'GCZJM35NKGVK47BB4SPBDV25477PZYIYPVVG453LPYFNXLS3FGHDXOCM';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    if (dataSource) {
      await dataSource.getRepository(AuthAttempt).delete({});
      await dataSource.getRepository(RefreshToken).delete({});
      await dataSource.getRepository(AuthChallenge).delete({});
      await dataSource.getRepository(User).delete({});
    }
    await app.close();
  });

  describe('POST /auth/challenge', () => {
    it('should generate a challenge for a valid Stellar address', () => {
      return request(app.getHttpServer())
        .post('/api/auth/challenge')
        .send({ walletAddress: WALLET })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('nonce');
          expect(res.body).toHaveProperty('expiresAt');
          expect(res.body).toHaveProperty('message');
          expect(res.body.nonce).toHaveLength(64);
          expect(res.body.message).toContain(res.body.nonce);
        });
    });

    it('should return 400 for invalid wallet address format', () => {
      return request(app.getHttpServer())
        .post('/api/auth/challenge')
        .send({ walletAddress: '0xinvalid' })
        .expect(400);
    });

    it('should return 400 for missing wallet address', () => {
      return request(app.getHttpServer())
        .post('/api/auth/challenge')
        .send({})
        .expect(400);
    });

    it('should replace existing challenge for same wallet', async () => {
      // First challenge
      const first = await request(app.getHttpServer())
        .post('/api/auth/challenge')
        .send({ walletAddress: WALLET })
        .expect(200);

      // Second challenge — should succeed and replace
      const second = await request(app.getHttpServer())
        .post('/api/auth/challenge')
        .send({ walletAddress: WALLET })
        .expect(200);

      expect(second.body.nonce).not.toBe(first.body.nonce);
    });
  });

  describe('POST /auth/verify', () => {
    it('should return 401 for invalid signature', async () => {
      // Generate a challenge first
      await request(app.getHttpServer())
        .post('/api/auth/challenge')
        .send({ walletAddress: WALLET });

      return request(app.getHttpServer())
        .post('/api/auth/verify')
        .send({
          walletAddress: WALLET,
          signature: 'aW52YWxpZHNpZ25hdHVyZQ==',
        })
        .expect(401);
    });

    it('should return 401 when no challenge exists', () => {
      return request(app.getHttpServer())
        .post('/api/auth/verify')
        .send({
          walletAddress: 'GBVZM26OEBC3YJZXNQZXNQZXNQZXNQZXNQZXNQZXNQZXNQZXNQZXNQ',
          signature: 'aW52YWxpZHNpZ25hdHVyZQ==',
        })
        .expect(401);
    });

    it('should return 400 for missing fields', () => {
      return request(app.getHttpServer())
        .post('/api/auth/verify')
        .send({ walletAddress: WALLET })
        .expect(400);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should return 401 for invalid refresh token', () => {
      return request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid.token.here' })
        .expect(401);
    });

    it('should return 400 for missing refresh token', () => {
      return request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({})
        .expect(400);
    });
  });

  describe('POST /auth/logout', () => {
    it('should return 401 without auth token', () => {
      return request(app.getHttpServer())
        .post('/api/auth/logout')
        .send({ refreshToken: 'some-token' })
        .expect(401);
    });
  });

  describe('Protected routes', () => {
    it('GET /users/me should return 401 without token', () => {
      return request(app.getHttpServer()).get('/api/users/me').expect(401);
    });

    it('PATCH /users/me should return 401 without token', () => {
      return request(app.getHttpServer())
        .patch('/api/users/me')
        .send({ displayName: 'Test' })
        .expect(401);
    });

    it('DELETE /users/me should return 401 without token', () => {
      return request(app.getHttpServer()).delete('/api/users/me').expect(401);
    });
  });

  describe('Public routes', () => {
    it('GET /users should be accessible without token', () => {
      return request(app.getHttpServer()).get('/api/users').expect(200);
    });

    it('POST /users should be accessible without token', () => {
      return request(app.getHttpServer())
        .post('/api/users')
        .send({ walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' })
        .expect(201);
    });
  });
});
