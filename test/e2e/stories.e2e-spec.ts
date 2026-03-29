import { randomUUID } from 'crypto';
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
import { ContentType, Story } from '../../src/stories/entities/story.entity';
import { StoriesRepository } from '../../src/stories/stories.repository';

describe('Stories (e2e)', () => {
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

  async function linkFriendContact(viewerUserId: string, friendWallet: string): Promise<void> {
    await dataSource.query(
      `INSERT INTO saved_addresses (id, "userId", "walletAddress", alias, network, tags, "usageCount")
       VALUES ($1, $2, $3, $4, 'stellar_mainnet', $5, 0)`,
      [randomUUID(), viewerUserId, friendWallet, `friend_${randomUUID().slice(0, 8)}`, ['friends']],
    );
  }

  it('contact sees friend story, can view, owner sees viewers; stranger forbidden', async () => {
    const aliceAuth = await authenticateViaChallenge(app, AUTH_WALLETS.primary);
    const bobAuth = await authenticateViaChallenge(app, AUTH_WALLETS.secondary);

    const bobUser = await getUserByWallet(dataSource, AUTH_WALLETS.secondary);
    expect(bobUser).toBeTruthy();
    await linkFriendContact(aliceAuth.user.id, bobUser!.walletAddress);

    const created = await request(app.getHttpServer())
      .post('/api/stories')
      .set('Authorization', `Bearer ${bobAuth.accessToken}`)
      .send({ contentType: ContentType.TEXT, content: 'status hello' })
      .expect(201);

    const feed = await request(app.getHttpServer())
      .get('/api/stories')
      .set('Authorization', `Bearer ${aliceAuth.accessToken}`)
      .expect(200);

    expect(feed.body.data).toHaveLength(1);
    expect(feed.body.data[0].id).toBe(created.body.id);
    expect(feed.body.data[0].viewCount).toBe(0);

    const viewed = await request(app.getHttpServer())
      .post(`/api/stories/${created.body.id}/view`)
      .set('Authorization', `Bearer ${aliceAuth.accessToken}`)
      .expect(200);

    expect(viewed.body.viewCount).toBe(1);

    const viewers = await request(app.getHttpServer())
      .get(`/api/stories/${created.body.id}/viewers`)
      .set('Authorization', `Bearer ${bobAuth.accessToken}`)
      .expect(200);

    expect(viewers.body.some((v: { viewerId: string }) => v.viewerId === aliceAuth.user.id)).toBe(
      true,
    );

    const charlieAuth = await authenticateViaChallenge(app, AUTH_WALLETS.tertiary);
    await request(app.getHttpServer())
      .post(`/api/stories/${created.body.id}/view`)
      .set('Authorization', `Bearer ${charlieAuth.accessToken}`)
      .expect(403);
  });

  it('rejects 31st active story', async () => {
    const bobAuth = await authenticateViaChallenge(app, AUTH_WALLETS.secondary);
    const bobUser = await getUserByWallet(dataSource, AUTH_WALLETS.secondary);
    expect(bobUser).toBeTruthy();

    const repo = dataSource.getRepository(Story);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 86_400_000);
    for (let i = 0; i < 30; i += 1) {
      await repo.save(
        repo.create({
          userId: bobUser!.id,
          contentType: ContentType.TEXT,
          content: `s${i}`,
          mediaUrl: null,
          backgroundColor: null,
          duration: 86_400_000,
          viewCount: 0,
          expiresAt,
        }),
      );
    }

    await request(app.getHttpServer())
      .post('/api/stories')
      .set('Authorization', `Bearer ${bobAuth.accessToken}`)
      .send({ contentType: ContentType.TEXT, content: 'one too many' })
      .expect(400);
  });

  it('deleteExpired removes past stories', async () => {
    const bobAuth = await authenticateViaChallenge(app, AUTH_WALLETS.secondary);
    const bobUser = await getUserByWallet(dataSource, AUTH_WALLETS.secondary);
    expect(bobUser).toBeTruthy();

    const repo = dataSource.getRepository(Story);
    await repo.save(
      repo.create({
        userId: bobUser!.id,
        contentType: ContentType.TEXT,
        content: 'old',
        mediaUrl: null,
        backgroundColor: null,
        duration: 86_400_000,
        viewCount: 0,
        expiresAt: new Date(Date.now() - 60_000),
      }),
    );

    const storiesRepo = app.get(StoriesRepository);
    const removed = await storiesRepo.deleteExpired();
    expect(removed).toBe(1);

    await request(app.getHttpServer())
      .get('/api/stories/mine')
      .set('Authorization', `Bearer ${bobAuth.accessToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toHaveLength(0);
      });
  });
});
