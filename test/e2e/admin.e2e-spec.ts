import request from 'supertest';
import { DataSource } from 'typeorm';
import { INestApplication } from '@nestjs/common';
import { AUTH_WALLETS } from './factories';
import {
  authenticateViaChallenge,
  createTestApp,
  getUserByWallet,
  truncateAllTables,
} from './setup/create-test-app';

describe('Admin moderation (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    process.env.ADMIN_USER_IDS = '';
    await truncateAllTables(dataSource);
  });

  it('revokes access for a deactivated user and restores it on reactivation', async () => {
    const adminAuth = await authenticateViaChallenge(app, AUTH_WALLETS.admin);
    const targetAuth = await authenticateViaChallenge(app, AUTH_WALLETS.primary);
    const targetUser = await getUserByWallet(dataSource, AUTH_WALLETS.primary);

    process.env.ADMIN_USER_IDS = adminAuth.user.id;

    await request(app.getHttpServer())
      .patch(`/api/admin/users/${targetUser!.id}/status`)
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .send({ isActive: false })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${targetAuth.accessToken}`)
      .expect(401);

    await request(app.getHttpServer())
      .patch(`/api/admin/users/${targetUser!.id}/status`)
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .send({ isActive: true })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${targetAuth.accessToken}`)
      .expect(200);
  });
});
