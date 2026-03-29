import request from 'supertest';
import { DataSource } from 'typeorm';
import { INestApplication } from '@nestjs/common';
import { AUTH_WALLETS, UserFactory } from './factories';
import {
  authenticateViaChallenge,
  createTestApp,
  truncateAllTables,
} from './setup/create-test-app';

describe('Platform invites (e2e)', () => {
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

  it('returns 403 without invite when invite mode is on; registers with valid code', async () => {
    const adminAuth = await authenticateViaChallenge(app, AUTH_WALLETS.admin);
    process.env.ADMIN_USER_IDS = adminAuth.user.id;

    await request(app.getHttpServer())
      .patch('/api/admin/invites/mode')
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .send({ enabled: true })
      .expect(200);

    const blocked = await request(app.getHttpServer())
      .post('/api/users')
      .send(UserFactory.build({ username: 'inv_blocked', walletAddress: undefined }))
      .expect(403);

    expect(blocked.body.message).toMatch(/invite/i);

    const created = await request(app.getHttpServer())
      .post('/api/admin/invites')
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .send({ maxUses: 1 })
      .expect(201);

    const code = created.body.code as string;
    expect(code).toHaveLength(16);

    const validated = await request(app.getHttpServer())
      .get(`/api/invites/${code}/validate`)
      .expect(200);

    expect(validated.body.valid).toBe(true);

    const ok = await request(app.getHttpServer())
      .post('/api/users')
      .send(
        UserFactory.build({
          username: 'inv_ok_user',
          inviteCode: code,
          walletAddress: undefined,
        }),
      )
      .expect(201);

    expect(ok.body).toHaveProperty('id');

    await request(app.getHttpServer())
      .get(`/api/invites/${code}/validate`)
      .expect(200)
      .expect((res) => {
        expect(res.body.valid).toBe(false);
      });
  });

  it('admin bulk, list, stats, and revoke', async () => {
    const adminAuth = await authenticateViaChallenge(app, AUTH_WALLETS.admin);
    process.env.ADMIN_USER_IDS = adminAuth.user.id;

    await request(app.getHttpServer())
      .post('/api/admin/invites/bulk')
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .send({ count: 2, maxUses: 1 })
      .expect(201)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(2);
      });

    const list = await request(app.getHttpServer())
      .get('/api/admin/invites')
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .expect(200);

    expect(list.body.items.length).toBeGreaterThanOrEqual(2);

    const stats = await request(app.getHttpServer())
      .get('/api/admin/invites/stats')
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .expect(200);

    expect(stats.body.totalInvites).toBeGreaterThanOrEqual(2);

    const id = list.body.items[0].id as string;
    await request(app.getHttpServer())
      .delete(`/api/admin/invites/${id}`)
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .expect(204);
  });
});
