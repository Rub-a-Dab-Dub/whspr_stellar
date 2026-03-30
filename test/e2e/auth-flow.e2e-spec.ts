import request from 'supertest';
import { DataSource } from 'typeorm';
import { INestApplication } from '@nestjs/common';
import { AUTH_WALLETS } from './factories';
import {
  authenticateViaChallenge,
  createTestApp,
  listUserSessions,
  truncateAllTables,
} from './setup/create-test-app';

describe('Auth flow (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables(dataSource);
  });

  it('covers challenge -> verify -> refresh -> logout', async () => {
    const challenge = await request(app.getHttpServer())
      .post('/api/auth/challenge')
      .send({ walletAddress: AUTH_WALLETS.primary })
      .expect(200);

    expect(challenge.body).toHaveProperty('nonce');
    expect(challenge.body).toHaveProperty('message');

    const verified = await authenticateViaChallenge(app, AUTH_WALLETS.primary);
    expect(verified.accessToken).toEqual(expect.any(String));
    expect(verified.refreshToken).toEqual(expect.any(String));
    expect(verified.user).toHaveProperty('id');

    const initialSessions = await listUserSessions(dataSource, verified.user.id);
    expect(initialSessions).toHaveLength(1);

    const refreshed = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: verified.refreshToken })
      .expect(200);

    expect(refreshed.body.accessToken).toEqual(expect.any(String));
    expect(refreshed.body.refreshToken).toEqual(expect.any(String));

    const rotatedSessions = await listUserSessions(dataSource, verified.user.id);
    expect(rotatedSessions.length).toBeGreaterThanOrEqual(1);

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${refreshed.body.accessToken}`)
      .send({ refreshToken: refreshed.body.refreshToken })
      .expect(204);
  });
});
