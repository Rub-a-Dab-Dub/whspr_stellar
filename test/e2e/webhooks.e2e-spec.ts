import request from 'supertest';
import { DataSource } from 'typeorm';
import { INestApplication } from '@nestjs/common';
import { WebhooksService } from '../../src/webhooks/webhooks.service';
import { AUTH_WALLETS, WebhookFactory } from './factories';
import {
  authenticateViaChallenge,
  createTestApp,
  truncateAllTables,
} from './setup/create-test-app';

describe('Webhooks (e2e)', () => {
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

  it('registers a webhook, triggers a delivery, and exposes delivery history', async () => {
    const auth = await authenticateViaChallenge(app, AUTH_WALLETS.primary);

    const created = await request(app.getHttpServer())
      .post('/api/webhooks')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send(WebhookFactory.build())
      .expect(201);

    const service = app.get(WebhooksService);
    await service.deliverEvent('transfer.completed', {
      transferId: 'transfer-434',
      userId: auth.user.id,
    });

    const deliveries = await request(app.getHttpServer())
      .get(`/api/webhooks/${created.body.id}/deliveries`)
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    expect(deliveries.body.length).toBeGreaterThan(0);
    expect(deliveries.body[0].eventType).toBe('transfer.completed');
  });
});
