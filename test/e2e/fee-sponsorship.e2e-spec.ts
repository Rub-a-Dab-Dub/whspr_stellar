import request from 'supertest';
import { DataSource } from 'typeorm';
import { INestApplication } from '@nestjs/common';
import { AUTH_WALLETS } from './factories';
import {
  authenticateViaChallenge,
  createTestApp,
  truncateAllTables,
} from './setup/create-test-app';

describe('Fee sponsorship (e2e)', () => {
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

  it('GET /api/sponsorship/quota returns quota shape for authenticated user', async () => {
    const auth = await authenticateViaChallenge(app, AUTH_WALLETS.primary);

    const res = await request(app.getHttpServer())
      .get('/api/sponsorship/quota')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      period: expect.any(String),
      quotaUsed: expect.any(Number),
      quotaLimit: expect.any(Number),
      remaining: expect.any(Number),
      resetAt: expect.any(String),
      eligible: expect.any(Boolean),
    });
  });

  it('GET /api/sponsorship/history returns paginated list', async () => {
    const auth = await authenticateViaChallenge(app, AUTH_WALLETS.primary);

    await request(app.getHttpServer())
      .get('/api/sponsorship/history?page=1&limit=10')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200)
      .expect((r) => {
        expect(Array.isArray(r.body.items)).toBe(true);
        expect(r.body.total).toBeDefined();
      });
  });
});
