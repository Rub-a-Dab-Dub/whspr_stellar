import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { CustomEmojiController } from '../custom-emoji.controller';
import { CustomEmojiService } from '../custom-emoji.service';

const groupId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const emojiId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const userId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const baseEmoji = {
  id: emojiId,
  groupId,
  uploadedBy: userId,
  name: 'party_parrot',
  imageUrl: 'https://cdn.example.com/emoji/group/party_parrot.png',
  usageCount: 0,
  isActive: true,
  createdAt: new Date().toISOString(),
};

const presignResponse = {
  uploadUrl: 'https://s3.example.com/presigned',
  fileKey: `emoji/${groupId}/party_parrot-uuid.png`,
  expiresIn: 300,
};

describe('CustomEmojiController (e2e)', () => {
  let app: INestApplication;
  let service: jest.Mocked<CustomEmojiService>;

  const buildApp = async (groupRole = 'admin') => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomEmojiController],
      providers: [
        {
          provide: CustomEmojiService,
          useValue: {
            generateUploadUrl: jest.fn().mockResolvedValue(presignResponse),
            confirmUpload: jest.fn().mockResolvedValue(baseEmoji),
            getGroupEmoji: jest.fn().mockResolvedValue([baseEmoji]),
            deleteEmoji: jest.fn().mockResolvedValue(undefined),
            searchEmoji: jest.fn().mockResolvedValue({ data: [baseEmoji], total: 1 }),
          },
        },
      ],
    }).compile();

    const nestApp = module.createNestApplication();
    nestApp.setGlobalPrefix('api');
    nestApp.use((req: any, _res: any, next: () => void) => {
      req.user = { id: userId, groupRole };
      next();
    });
    nestApp.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await nestApp.init();

    service = module.get(CustomEmojiService) as jest.Mocked<CustomEmojiService>;
    return nestApp;
  };

  afterEach(() => app?.close());

  // ─── POST /groups/:id/emoji/presign ─────────────────────────────────────────

  describe('POST /api/groups/:id/emoji/presign', () => {
    it('returns presigned URL for admin', async () => {
      app = await buildApp('admin');

      await request(app.getHttpServer())
        .post(`/api/groups/${groupId}/emoji/presign`)
        .send({ name: 'party_parrot', mimeType: 'image/png', fileSize: 10000 })
        .expect(201)
        .expect((res) => {
          expect(res.body.uploadUrl).toBe(presignResponse.uploadUrl);
          expect(res.body.fileKey).toBeDefined();
          expect(res.body.expiresIn).toBe(300);
        });

      expect(service.generateUploadUrl).toHaveBeenCalledWith(
        userId,
        groupId,
        'admin',
        { name: 'party_parrot', mimeType: 'image/png', fileSize: 10000 },
      );
    });

    it('rejects name with uppercase letters', async () => {
      app = await buildApp('admin');

      await request(app.getHttpServer())
        .post(`/api/groups/${groupId}/emoji/presign`)
        .send({ name: 'PartyParrot', mimeType: 'image/png', fileSize: 10000 })
        .expect(400);
    });

    it('rejects name shorter than 2 chars', async () => {
      app = await buildApp('admin');

      await request(app.getHttpServer())
        .post(`/api/groups/${groupId}/emoji/presign`)
        .send({ name: 'a', mimeType: 'image/png', fileSize: 10000 })
        .expect(400);
    });

    it('rejects name longer than 32 chars', async () => {
      app = await buildApp('admin');

      await request(app.getHttpServer())
        .post(`/api/groups/${groupId}/emoji/presign`)
        .send({ name: 'a'.repeat(33), mimeType: 'image/png', fileSize: 10000 })
        .expect(400);
    });

    it('rejects file size exceeding 256 KB', async () => {
      app = await buildApp('admin');

      await request(app.getHttpServer())
        .post(`/api/groups/${groupId}/emoji/presign`)
        .send({ name: 'party_parrot', mimeType: 'image/png', fileSize: 300 * 1024 })
        .expect(400);
    });
  });

  // ─── POST /groups/:id/emoji/confirm ─────────────────────────────────────────

  describe('POST /api/groups/:id/emoji/confirm', () => {
    it('confirms upload and returns emoji record', async () => {
      app = await buildApp('admin');

      await request(app.getHttpServer())
        .post(`/api/groups/${groupId}/emoji/confirm`)
        .send({
          name: 'party_parrot',
          fileKey: `emoji/${groupId}/party_parrot-uuid.png`,
          imageUrl: 'https://cdn.example.com/emoji/group/party_parrot.png',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.id).toBe(emojiId);
          expect(res.body.name).toBe('party_parrot');
          expect(res.body.isActive).toBe(true);
        });
    });

    it('rejects invalid emoji name in confirm body', async () => {
      app = await buildApp('admin');

      await request(app.getHttpServer())
        .post(`/api/groups/${groupId}/emoji/confirm`)
        .send({
          name: 'bad name!',
          fileKey: 'emoji/group/bad.png',
          imageUrl: 'https://cdn.example.com/bad.png',
        })
        .expect(400);
    });
  });

  // ─── GET /groups/:id/emoji ───────────────────────────────────────────────────

  describe('GET /api/groups/:id/emoji', () => {
    it('returns list of active emoji scoped to group', async () => {
      app = await buildApp('member');

      await request(app.getHttpServer())
        .get(`/api/groups/${groupId}/emoji`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body).toHaveLength(1);
          expect(res.body[0].groupId).toBe(groupId);
          expect(res.body[0].isActive).toBe(true);
        });
    });

    it('supports multiple emoji in same group (picker scope)', async () => {
      app = await buildApp('member');
      service.getGroupEmoji.mockResolvedValueOnce([
        baseEmoji as any,
        { ...baseEmoji, id: 'emoji-2', name: 'wave' } as any,
      ]);

      await request(app.getHttpServer())
        .get(`/api/groups/${groupId}/emoji`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveLength(2);
          const names = res.body.map((e: any) => e.name);
          expect(names).toContain('party_parrot');
          expect(names).toContain('wave');
        });
    });
  });

  // ─── DELETE /groups/:id/emoji/:emojiId ───────────────────────────────────────

  describe('DELETE /api/groups/:id/emoji/:emojiId', () => {
    it('deletes emoji with 204 for admin', async () => {
      app = await buildApp('admin');

      await request(app.getHttpServer())
        .delete(`/api/groups/${groupId}/emoji/${emojiId}`)
        .expect(204);

      expect(service.deleteEmoji).toHaveBeenCalledWith(userId, groupId, emojiId, 'admin');
    });
  });

  // ─── GET /emoji/search ───────────────────────────────────────────────────────

  describe('GET /api/emoji/search', () => {
    it('returns search results with total count', async () => {
      app = await buildApp('member');

      await request(app.getHttpServer())
        .get('/api/emoji/search?q=party')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.total).toBe(1);
          expect(res.body.data[0].name).toBe('party_parrot');
        });
    });

    it('scopes search to group when groupId provided', async () => {
      app = await buildApp('member');

      await request(app.getHttpServer())
        .get(`/api/emoji/search?q=party&groupId=${groupId}`)
        .expect(200);

      expect(service.searchEmoji).toHaveBeenCalledWith('party', groupId, 1, 20);
    });

    it('rejects missing query param', async () => {
      app = await buildApp('member');

      await request(app.getHttpServer())
        .get('/api/emoji/search')
        .expect(400);
    });
  });
});
