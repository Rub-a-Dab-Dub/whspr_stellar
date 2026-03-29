import request from 'supertest';
import { DataSource } from 'typeorm';
import { INestApplication } from '@nestjs/common';
import { ModerationQueueService } from '../../src/ai-moderation/queue/moderation.queue';
import { S3StorageService } from '../../src/attachments/storage/s3-storage.service';
import { User, UserTier } from '../../src/users/entities/user.entity';
import { AUTH_WALLETS } from './factories';
import {
  authenticateViaChallenge,
  createTestApp,
  getUserByWallet,
  truncateAllTables,
} from './setup/create-test-app';

describe('UGC sticker packs (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp((b) =>
      b
        .overrideProvider(S3StorageService)
        .useValue({
          generateUploadUrl: jest.fn(),
          getObjectBuffer: jest.fn().mockResolvedValue(
            Buffer.from(
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
              'base64',
            ),
          ),
          putObjectBuffer: jest.fn().mockResolvedValue(undefined),
          resolveFileUrl: jest.fn((key: string) => `https://cdn.test/${key}`),
          deleteFile: jest.fn().mockResolvedValue(undefined),
        })
        .overrideProvider(ModerationQueueService)
        .useValue({
          enqueueProfileModeration: jest.fn(),
          enqueueUserModeration: jest.fn(),
          enqueueImageModeration: jest.fn().mockResolvedValue(undefined),
        }),
    ));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    process.env.ADMIN_USER_IDS = '';
    await truncateAllTables(dataSource);
  });

  it('browse stays empty until admin approves; download adds stickers to library', async () => {
    const creator = await authenticateViaChallenge(app, AUTH_WALLETS.primary);
    const secondary = await authenticateViaChallenge(app, AUTH_WALLETS.secondary);
    const adminAuth = await authenticateViaChallenge(app, AUTH_WALLETS.admin);

    const createRes = await request(app.getHttpServer())
      .post('/api/sticker-packs')
      .set('Authorization', `Bearer ${creator.accessToken}`)
      .send({ name: 'My Pack', description: 'd', price: 0 })
      .expect(201);

    const packId = createRes.body.id as string;

    await request(app.getHttpServer())
      .post(`/api/sticker-packs/${packId}/stickers`)
      .set('Authorization', `Bearer ${creator.accessToken}`)
      .send({ name: 'st1', fileKey: 'incoming/raw.png', tags: ['a', 'b'] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/sticker-packs/${packId}/publish`)
      .set('Authorization', `Bearer ${creator.accessToken}`)
      .expect(200);

    const browsePending = await request(app.getHttpServer()).get('/api/sticker-packs/browse').expect(200);
    expect(browsePending.body.items).toHaveLength(0);

    process.env.ADMIN_USER_IDS = adminAuth.user.id;

    await request(app.getHttpServer())
      .post(`/api/admin/sticker-packs/${packId}/approve`)
      .set('Authorization', `Bearer ${adminAuth.accessToken}`)
      .expect(200);

    const browseOk = await request(app.getHttpServer()).get('/api/sticker-packs/browse').expect(200);
    expect(browseOk.body.items.length).toBe(1);

    await request(app.getHttpServer())
      .post(`/api/sticker-packs/${packId}/download`)
      .set('Authorization', `Bearer ${secondary.accessToken}`)
      .expect(200);

    const lib = await request(app.getHttpServer())
      .get('/api/sticker-packs/library')
      .set('Authorization', `Bearer ${secondary.accessToken}`)
      .expect(200);

    expect(Array.isArray(lib.body)).toBe(true);
    expect(lib.body.length).toBe(1);
  });

  it('enforces max packs for silver tier', async () => {
    const creator = await authenticateViaChallenge(app, AUTH_WALLETS.primary);
    const u = await getUserByWallet(dataSource, AUTH_WALLETS.primary);
    await dataSource.getRepository(User).update({ id: u!.id }, { tier: UserTier.SILVER });

    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .post('/api/sticker-packs')
        .set('Authorization', `Bearer ${creator.accessToken}`)
        .send({ name: `P${i}` })
        .expect(201);
    }

    await request(app.getHttpServer())
      .post('/api/sticker-packs')
      .set('Authorization', `Bearer ${creator.accessToken}`)
      .send({ name: 'P4' })
      .expect(400);
  });
});
