import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Story } from '../src/stories/entities/story.entity';
import { StoryView } from '../src/stories/entities/story-view.entity';

describe('Stories (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/stories (POST)', () => {
    it('should create a story (requires auth)', async () => {
      const auth = await authenticateViaChallenge(app, AUTH_WALLETS.primary);
      const res = await request(app.getHttpServer())
        .post('/api/stories')
        .set('Authorization', `Bearer ${auth.accessToken}`)
        .send({
          contentType: 'TEXT',
          content: 'Hello story!',
        })
        .expect(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.contentType).toBe('TEXT');
    });

    it('enforces 30 active stories max', async () => {
      // Setup 30 active stories then fail 31st
      // (omitted for brevity)
    });
  });

  describe('/stories (GET contacts)', () => {
    it('returns only contact stories (requires auth)', async () => {
      const auth = await authenticateViaChallenge(app, AUTH_WALLETS.primary);
      // Save friend contact
      await request(app.getHttpServer())
        .post('/api/address-book')
        .set('Authorization', `Bearer ${auth.accessToken}`)
        .send({
          walletAddress: AUTH_WALLETS.friend.address,
          alias: 'Friend',
          tags: ['friends'],
        });

      const res = await request(app.getHttpServer())
        .get('/api/stories')
        .set('Authorization', `Bearer ${auth.accessToken}`)
        .expect(200);
      expect(Array.isArray(res.body.stories)).toBe(true);
      expect(res.body.stories).toHaveLength(0); // initially
    });
  });

  describe('/stories/mine (GET)', () => {
    it('returns only own active stories', async () => {
      // auth, create story, get mine, check viewers populated for owner
    });
  });

  describe('/stories/:id (DELETE)', () => {
    it('deletes own story', async () => {
      // create, delete 204
    });
  });

  describe('/stories/:id/viewers (GET)', () => {
    it('returns viewers for own story', async () => {
      // create, view from another user, get viewers
    });
  });

  describe('Auto-expiry', () => {
    it('expired stories not returned, cron deletes', async () => {
      // create with expiresAt past, check not in list, cron runs delete
    });
  });

  // WS tests omitted, manual
});

