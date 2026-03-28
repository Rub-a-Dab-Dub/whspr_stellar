import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { User, UserTier } from '../src/users/entities/user.entity';

describe('UsernameDiscoveryController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let requesterId: string;
  let requesterWallet: string;
  let token: string;

  const userWallet = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const hiddenWallet = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
  const blockedWallet = 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';

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
    jwtService = moduleFixture.get(JwtService);

    const userRepo = dataSource.getRepository(User);
    const requester = await userRepo.save(
      userRepo.create({
        walletAddress: 'GREQUESTERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        username: 'requester',
        tier: UserTier.SILVER,
        isActive: true,
      }),
    );
    requesterId = requester.id;
    requesterWallet = requester.walletAddress;
    token = jwtService.sign({ sub: requester.id, walletAddress: requester.walletAddress });

    const alice = await userRepo.save(
      userRepo.create({
        walletAddress: userWallet,
        username: 'alice',
        displayName: 'Alice A',
        tier: UserTier.GOLD,
        isActive: true,
      }),
    );

    const hidden = await userRepo.save(
      userRepo.create({
        walletAddress: hiddenWallet,
        username: 'hiddenone',
        displayName: 'Hidden One',
        tier: UserTier.SILVER,
        isActive: true,
      }),
    );

    const blocked = await userRepo.save(
      userRepo.create({
        walletAddress: blockedWallet,
        username: 'blockedguy',
        displayName: 'Blocked Guy',
        tier: UserTier.SILVER,
        isActive: true,
      }),
    );

    await dataSource.query(
      `
      INSERT INTO user_settings ("userId", "notificationPreferences", "privacySettings", theme, language, timezone, "twoFactorEnabled")
      VALUES
        ($1, $4::jsonb, $5::jsonb, 'system', 'en', 'UTC', false),
        ($2, $4::jsonb, $6::jsonb, 'system', 'en', 'UTC', false),
        ($3, $4::jsonb, $5::jsonb, 'system', 'en', 'UTC', false)
      ON CONFLICT ("userId") DO UPDATE
      SET "privacySettings" = EXCLUDED."privacySettings"
      `,
      [
        alice.id,
        hidden.id,
        blocked.id,
        JSON.stringify({
          messages: { push: true, email: false, inApp: true },
          mentions: { push: true, email: true, inApp: true },
          system: { push: false, email: true, inApp: true },
        }),
        JSON.stringify({
          lastSeenVisibility: 'everyone',
          readReceiptsEnabled: true,
          onlineStatusVisible: true,
        }),
        JSON.stringify({
          lastSeenVisibility: 'nobody',
          readReceiptsEnabled: true,
          onlineStatusVisible: true,
        }),
      ],
    );

    await dataSource.query(
      `
      INSERT INTO saved_addresses ("userId", "walletAddress", alias, network, tags, "usageCount")
      VALUES ($1, $2, 'Requester', 'stellar_mainnet', '{}', 0)
      `,
      [alice.id, requesterWallet],
    );

    await dataSource.query(
      `
      INSERT INTO discovery_user_blocks ("blockerId", "blockedId")
      VALUES ($1, $2)
      `,
      [requester.id, blocked.id],
    );
  });

  afterAll(async () => {
    if (dataSource) {
      await dataSource.query(`DELETE FROM discovery_user_blocks`);
      await dataSource.query(`DELETE FROM saved_addresses`);
      await dataSource.query(`DELETE FROM user_settings`);
      await dataSource.getRepository(User).delete({});
    }

    if (app) {
      await app.close();
    }
  });

  it('GET /discover?q returns visible users and excludes hidden/blocked users', async () => {
    await request(app.getHttpServer())
      .get('/api/discover?q=ali')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.some((u: any) => u.username === 'alice')).toBe(true);
        expect(res.body.some((u: any) => u.username === 'hiddenone')).toBe(false);
        expect(res.body.some((u: any) => u.username === 'blockedguy')).toBe(false);
      });
  });

  it('GET /discover/username/:username returns a masked wallet card summary', async () => {
    await request(app.getHttpServer())
      .get('/api/discover/username/alice')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.username).toBe('alice');
        expect(res.body.walletAddressMasked).toContain('...');
      });
  });

  it('GET /discover/:username/card returns public card with deep link', async () => {
    await request(app.getHttpServer())
      .get('/api/discover/alice/card')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.username).toBe('alice');
        expect(res.body.deepLink).toBe('gasless://profile/alice');
      });
  });

  it('GET /discover/:username/qr returns PNG response', async () => {
    await request(app.getHttpServer())
      .get('/api/discover/alice/qr')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect('Content-Type', /image\/png/);
  });
});
