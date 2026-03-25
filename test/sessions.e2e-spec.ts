import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { UserSession } from '../src/sessions/entities/user-session.entity';
import { User, UserTier } from '../src/users/entities/user.entity';

describe('SessionsController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  const userId = '0d70d27e-9634-4af4-9af4-14dcb1ec4190';
  const currentSessionId = '70adf113-85fd-425c-8975-c591cd56fdc0';
  const otherSessionId = '17bc3339-5ccb-4fe6-9b63-87e3822fc410';
  const walletAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';

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
    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  beforeEach(async () => {
    await dataSource.getRepository(UserSession).delete({});
    await dataSource.getRepository(User).delete({});

    await dataSource.getRepository(User).save({
      id: userId,
      walletAddress,
      username: null,
      email: null,
      displayName: 'Session Tester',
      avatarUrl: null,
      bio: null,
      tier: UserTier.FREE,
      isActive: true,
      isVerified: false,
    });

    await dataSource.getRepository(UserSession).save([
      {
        id: currentSessionId,
        userId,
        refreshTokenHash: 'hash-1',
        deviceInfo: 'Chrome on macOS',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0 Chrome/124.0.0.0',
        lastActiveAt: new Date('2026-03-20T08:00:00.000Z'),
        expiresAt: new Date('2026-04-20T08:00:00.000Z'),
        revokedAt: null,
      },
      {
        id: otherSessionId,
        userId,
        refreshTokenHash: 'hash-2',
        deviceInfo: 'Safari on iOS',
        ipAddress: '203.0.113.10',
        userAgent: 'Mozilla/5.0 iPhone',
        lastActiveAt: new Date('2026-03-19T08:00:00.000Z'),
        expiresAt: new Date('2026-04-19T08:00:00.000Z'),
        revokedAt: null,
      },
    ]);
  });

  afterAll(async () => {
    if (dataSource) {
      await dataSource.getRepository(UserSession).delete({});
      await dataSource.getRepository(User).delete({});
    }
    if (app) {
      await app.close();
    }
  });

  const signAccessToken = (sessionId: string) =>
    jwtService.sign({ sub: userId, walletAddress, sessionId });

  it('lists active sessions with device info and current-session marker', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/sessions')
      .set('Authorization', `Bearer ${signAccessToken(currentSessionId)}`)
      .expect(200);

    expect(response.body).toHaveLength(2);
    expect(response.body[0]).toEqual(expect.objectContaining({ deviceInfo: 'Chrome on macOS' }));
    expect(response.body.find((item: any) => item.id === currentSessionId)).toEqual(
      expect.objectContaining({ isCurrent: true }),
    );
  });

  it('revokes a single session and immediately invalidates its access token', async () => {
    await request(app.getHttpServer())
      .delete(`/api/sessions/${otherSessionId}`)
      .set('Authorization', `Bearer ${signAccessToken(currentSessionId)}`)
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${signAccessToken(otherSessionId)}`)
      .expect(401);
  });

  it('revokes all other sessions but keeps the current session active', async () => {
    await request(app.getHttpServer())
      .delete('/api/sessions')
      .set('Authorization', `Bearer ${signAccessToken(currentSessionId)}`)
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${signAccessToken(currentSessionId)}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${signAccessToken(otherSessionId)}`)
      .expect(401);
  });

  it('updates last active time on authenticated requests', async () => {
    const before = await dataSource
      .getRepository(UserSession)
      .findOneByOrFail({ id: currentSessionId });

    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${signAccessToken(currentSessionId)}`)
      .expect(200);

    const after = await dataSource
      .getRepository(UserSession)
      .findOneByOrFail({ id: currentSessionId });

    expect(new Date(after.lastActiveAt).getTime()).toBeGreaterThan(
      new Date(before.lastActiveAt).getTime(),
    );
  });
});
