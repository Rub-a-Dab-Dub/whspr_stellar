import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { User } from '../src/users/entities/user.entity';
import { Wallet } from '../src/wallets/entities/wallet.entity';
import { WalletNetwork } from '../src/wallets/entities/wallet.entity';
import { HorizonService } from '../src/wallets/services/horizon.service';

const STELLAR_ADDR_1 = 'GCZJM35NKGVK47BB4SPBDV25477PZYIYPVVG453LPYFNXLS3FGHDXOCM';
const STELLAR_ADDR_2 = 'GBVZM26OEBC3YJZXNQZXNQZXNQZXNQZXNQZXNQZXNQZXNQZXNQZXNQ2';

describe('WalletsController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let authToken: string;
  let userId: string;
  let walletId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HorizonService)
      .useValue({
        isValidAddress: (addr: string) => /^G[A-Z2-7]{55}$/.test(addr),
        getBalances: jest.fn().mockResolvedValue([
          {
            assetCode: 'XLM',
            assetType: 'native',
            assetIssuer: null,
            balance: '100.0000000',
            buyingLiabilities: '0.0000000',
            sellingLiabilities: '0.0000000',
          },
        ]),
        buildVerificationMessage: (addr: string, uid: string) =>
          `verify:${addr}:${uid}`,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    // Create a test user directly in DB
    const userRepo = dataSource.getRepository(User);
    const user = userRepo.create({
      walletAddress: '0xtest000000000000000000000000000000000001',
      username: 'wallettest',
      isActive: true,
      isVerified: false,
    });
    const saved = await userRepo.save(user);
    userId = saved.id;

    // Mint a JWT for that user
    authToken = jwtService.sign({ sub: userId, walletAddress: user.walletAddress });
  });

  afterAll(async () => {
    if (dataSource) {
      await dataSource.getRepository(Wallet).delete({});
      await dataSource.getRepository(User).delete({ id: userId });
    }
    await app.close();
  });

  // ─── POST /wallets ─────────────────────────────────────────────────────────

  describe('POST /api/wallets', () => {
    it('links a new wallet and auto-sets isPrimary=true for first wallet', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/wallets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ walletAddress: STELLAR_ADDR_1, label: 'Main' })
        .expect(201);

      expect(res.body.walletAddress).toBe(STELLAR_ADDR_1);
      expect(res.body.isPrimary).toBe(true);
      expect(res.body.isVerified).toBe(false);
      expect(res.body.label).toBe('Main');
      walletId = res.body.id;
    });

    it('links a second wallet with isPrimary=false', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/wallets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ walletAddress: STELLAR_ADDR_2 })
        .expect(201);

      expect(res.body.isPrimary).toBe(false);
    });

    it('returns 409 for duplicate wallet', () => {
      return request(app.getHttpServer())
        .post('/api/wallets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ walletAddress: STELLAR_ADDR_1 })
        .expect(409);
    });

    it('returns 400 for invalid Stellar address', () => {
      return request(app.getHttpServer())
        .post('/api/wallets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ walletAddress: 'not-a-stellar-address' })
        .expect(400);
    });

    it('returns 400 for invalid network enum', () => {
      return request(app.getHttpServer())
        .post('/api/wallets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ walletAddress: STELLAR_ADDR_1, network: 'ethereum' })
        .expect(400);
    });

    it('returns 401 without auth token', () => {
      return request(app.getHttpServer())
        .post('/api/wallets')
        .send({ walletAddress: STELLAR_ADDR_1 })
        .expect(401);
    });
  });

  // ─── GET /wallets ──────────────────────────────────────────────────────────

  describe('GET /api/wallets', () => {
    it('returns all wallets for the authenticated user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/wallets')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      expect(res.body[0]).toHaveProperty('walletAddress');
      expect(res.body[0]).toHaveProperty('isPrimary');
    });

    it('returns 401 without auth token', () => {
      return request(app.getHttpServer()).get('/api/wallets').expect(401);
    });
  });

  // ─── PATCH /wallets/:id/primary ────────────────────────────────────────────

  describe('PATCH /api/wallets/:id/primary', () => {
    let secondWalletId: string;

    beforeAll(async () => {
      const walletRepo = dataSource.getRepository(Wallet);
      const wallets = await walletRepo.find({ where: { userId } });
      const second = wallets.find((w) => !w.isPrimary);
      secondWalletId = second!.id;
    });

    it('sets a non-primary wallet as primary', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/wallets/${secondWalletId}/primary`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.isPrimary).toBe(true);
      expect(res.body.id).toBe(secondWalletId);
    });

    it('is idempotent — calling again returns same result', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/wallets/${secondWalletId}/primary`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.isPrimary).toBe(true);
    });

    it('returns 404 for unknown wallet id', () => {
      return request(app.getHttpServer())
        .patch('/api/wallets/00000000-0000-0000-0000-000000000000/primary')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('returns 400 for invalid UUID', () => {
      return request(app.getHttpServer())
        .patch('/api/wallets/not-a-uuid/primary')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  // ─── GET /wallets/:id/balance ──────────────────────────────────────────────

  describe('GET /api/wallets/:id/balance', () => {
    it('returns balance from Horizon (mocked)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/wallets/${walletId}/balance`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.walletAddress).toBe(STELLAR_ADDR_1);
      expect(Array.isArray(res.body.balances)).toBe(true);
      expect(res.body.balances[0].assetCode).toBe('XLM');
      expect(res.body).toHaveProperty('fetchedAt');
      expect(res.body.cached).toBe(false);
    });

    it('returns cached=true on second call within TTL', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/wallets/${walletId}/balance`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.cached).toBe(true);
    });

    it('returns 404 for unknown wallet', () => {
      return request(app.getHttpServer())
        .get('/api/wallets/00000000-0000-0000-0000-000000000000/balance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('returns 401 without auth token', () => {
      return request(app.getHttpServer())
        .get(`/api/wallets/${walletId}/balance`)
        .expect(401);
    });
  });

  // ─── DELETE /wallets/:id ───────────────────────────────────────────────────

  describe('DELETE /api/wallets/:id', () => {
    it('returns 400 when removing primary wallet while others exist', async () => {
      // Ensure walletId is primary
      await request(app.getHttpServer())
        .patch(`/api/wallets/${walletId}/primary`)
        .set('Authorization', `Bearer ${authToken}`);

      return request(app.getHttpServer())
        .delete(`/api/wallets/${walletId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('removes a non-primary wallet', async () => {
      const walletRepo = dataSource.getRepository(Wallet);
      const wallets = await walletRepo.find({ where: { userId } });
      const nonPrimary = wallets.find((w) => !w.isPrimary);

      await request(app.getHttpServer())
        .delete(`/api/wallets/${nonPrimary!.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      const remaining = await walletRepo.find({ where: { userId } });
      expect(remaining.find((w) => w.id === nonPrimary!.id)).toBeUndefined();
    });

    it('returns 404 for unknown wallet', () => {
      return request(app.getHttpServer())
        .delete('/api/wallets/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('returns 401 without auth token', () => {
      return request(app.getHttpServer())
        .delete(`/api/wallets/${walletId}`)
        .expect(401);
    });
  });
});
