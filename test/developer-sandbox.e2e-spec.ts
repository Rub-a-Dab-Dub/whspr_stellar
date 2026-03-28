import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { User, UserTier } from '../src/users/entities/user.entity';

describe('DeveloperSandboxController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let userId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = process.env.NODE_ENV || 'test';
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'test_jwt_secret_minimum_32_characters_long';

    const { AppModule } = await import('../src/app.module');

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

    dataSource = moduleFixture.get(DataSource);
    const jwtService = moduleFixture.get(JwtService);
    const userRepo = dataSource.getRepository(User);

    const user = await userRepo.save(
      userRepo.create({
        walletAddress: 'GSANDBOXAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        username: 'sandboxdev',
        tier: UserTier.SILVER,
        isActive: true,
      }),
    );

    userId = user.id;
    token = jwtService.sign({ sub: user.id, walletAddress: user.walletAddress });
  });

  afterAll(async () => {
    if (dataSource) {
      await dataSource.query(`DELETE FROM sandbox_transactions`);
      await dataSource.query(`DELETE FROM sandbox_environments`);
      await dataSource.getRepository(User).delete({ id: userId });
    }
    if (app) {
      await app.close();
    }
  });

  it('POST /sandbox creates sandbox environment', async () => {
    await request(app.getHttpServer())
      .post('/api/sandbox')
      .set('Authorization', `Bearer ${token}`)
      .expect(201)
      .expect((res) => {
        expect(res.body.userId).toBe(userId);
        expect(res.body.apiKeyId.startsWith('sbx_')).toBe(true);
        expect(Array.isArray(res.body.testWallets)).toBe(true);
      });
  });

  it('POST /sandbox/wallets generates and auto-funds testnet wallet', async () => {
    await request(app.getHttpServer())
      .post('/api/sandbox/wallets')
      .set('Authorization', `Bearer ${token}`)
      .expect(201)
      .expect((res) => {
        expect(res.body.network).toBe('stellar_testnet');
        expect(res.body.funded).toBe(true);
      });
  });

  it('GET /sandbox/transactions returns sandbox-marked transactions', async () => {
    await request(app.getHttpServer())
      .get('/api/sandbox/transactions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.every((tx: any) => tx.isSandbox === true)).toBe(true);
      });
  });

  it('POST /sandbox/reset clears sandbox wallets quickly', async () => {
    await request(app.getHttpServer())
      .post('/api/sandbox/reset')
      .set('Authorization', `Bearer ${token}`)
      .expect(201)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.completedInMs).toBeLessThanOrEqual(5000);
      });

    await request(app.getHttpServer())
      .get('/api/sandbox')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body.testWallets)).toBe(true);
        expect(res.body.testWallets).toHaveLength(0);
      });
  });

  it('DELETE /sandbox removes sandbox environment and data', async () => {
    await request(app.getHttpServer())
      .delete('/api/sandbox')
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
  });
});
