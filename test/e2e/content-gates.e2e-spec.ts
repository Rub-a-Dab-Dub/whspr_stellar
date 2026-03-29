import request from 'supertest';
import { DataSource } from 'typeorm';
import { INestApplication } from '@nestjs/common';
import { User, UserTier } from '../../src/users/entities/user.entity';
import { AUTH_WALLETS } from './factories';
import {
  authenticateViaChallenge,
  createTestApp,
  truncateAllTables,
} from './setup/create-test-app';

describe('Content gates (e2e)', () => {
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

  it('returns 402 with gate details when staking tier is not met, then 200 after tier upgrade', async () => {
    const auth = await authenticateViaChallenge(app, AUTH_WALLETS.primary);

    const created = await request(app.getHttpServer())
      .post('/api/content-gates')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        contentType: 'MESSAGE',
        contentId: 'gated-msg-1',
        gateType: 'STAKING_TIER',
        gateToken: 'gold',
        minBalance: '0',
        network: 'stellar_testnet',
      })
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/content-gates/MESSAGE/gated-msg-1')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              gateType: 'STAKING_TIER',
              gateToken: 'gold',
              contentId: 'gated-msg-1',
            }),
          ]),
        );
      });

    await request(app.getHttpServer())
      .post('/api/content-gates/verify')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ contentType: 'MESSAGE', contentId: 'gated-msg-1' })
      .expect(402)
      .expect((res) => {
        expect(res.body.message).toBeDefined();
        expect(res.body.gates).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ gateToken: 'gold', gateType: 'STAKING_TIER' }),
          ]),
        );
      });

    await dataSource.getRepository(User).update({ id: auth.user.id }, { tier: UserTier.GOLD });

    await request(app.getHttpServer())
      .post('/api/content-gates/verify')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ contentType: 'MESSAGE', contentId: 'gated-msg-1' })
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({ allowed: true });
      });

    await request(app.getHttpServer())
      .delete(`/api/content-gates/${created.body.id}`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .post('/api/content-gates/verify')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ contentType: 'MESSAGE', contentId: 'gated-msg-1' })
      .expect(200);
  });

  it('batch verify returns per-item allowed flags', async () => {
    const auth = await authenticateViaChallenge(app, AUTH_WALLETS.primary);

    await request(app.getHttpServer())
      .post('/api/content-gates/verify/batch')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({
        items: [
          { contentType: 'MESSAGE', contentId: 'plain-a' },
          { contentType: 'THREAD', contentId: 'plain-b' },
        ],
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.results).toHaveLength(2);
        expect(res.body.results.every((r: { allowed: boolean }) => r.allowed === true)).toBe(true);
      });
  });
});
