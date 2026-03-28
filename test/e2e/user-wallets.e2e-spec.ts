import request from 'supertest';
import { DataSource } from 'typeorm';
import { INestApplication } from '@nestjs/common';
import { AUTH_WALLETS } from './factories';
import {
  authenticateViaChallenge,
  createTestApp,
  truncateAllTables,
} from './setup/create-test-app';

describe('User, sessions, and wallets (e2e)', () => {
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

  it('updates the authenticated profile and exercises wallet management', async () => {
    const auth = await authenticateViaChallenge(app, AUTH_WALLETS.primary);

    await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        username: 'e2e_wallet_user',
        email: 'wallet-user@example.com',
        displayName: 'Wallet User',
        bio: 'Exercises the wallet flow',
        preferredLocale: 'fr',
      })
      .expect(200);

    const profile = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(profile.body.username).toBe('e2e_wallet_user');
    expect(profile.body.preferredLocale).toBe('fr');

    const firstWallet = await request(app.getHttpServer())
      .post('/api/wallets')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        walletAddress: AUTH_WALLETS.secondary,
        label: 'Primary wallet',
      })
      .expect(201);

    expect(firstWallet.body.isPrimary).toBe(true);

    const secondWallet = await request(app.getHttpServer())
      .post('/api/wallets')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        walletAddress: AUTH_WALLETS.tertiary,
        label: 'Backup wallet',
      })
      .expect(201);

    expect(secondWallet.body.isPrimary).toBe(false);

    await request(app.getHttpServer())
      .patch(`/api/wallets/${secondWallet.body.id}/primary`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    const wallets = await request(app.getHttpServer())
      .get('/api/wallets')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(wallets.body).toHaveLength(2);
    expect(wallets.body.find((wallet: any) => wallet.id === secondWallet.body.id)?.isPrimary).toBe(
      true,
    );

    const balance = await request(app.getHttpServer())
      .get(`/api/wallets/${secondWallet.body.id}/balance`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(balance.body.walletAddress).toBe(AUTH_WALLETS.tertiary);

    await request(app.getHttpServer())
      .get('/api/sessions')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);
  });
});
