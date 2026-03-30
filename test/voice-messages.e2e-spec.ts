import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { VoiceMessage } from '../src/voice-messages/entities/voice-message.entity';

describe('VoiceMessagesController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterEach(async () => {
    await dataSource.getRepository(VoiceMessage).delete({});
  });

  afterAll(async () => {
    await app.close();
  });

  // ── POST /api/voice-messages/presign ──────────────────────────────────────

  describe('POST /api/voice-messages/presign', () => {
    it('returns 401 without auth token', async () => {
      await request(app.getHttpServer())
        .post('/api/voice-messages/presign')
        .send({
          messageId: '00000000-0000-0000-0000-000000000001',
          mimeType: 'audio/ogg',
          fileSize: 51200,
          duration: 30,
        })
        .expect(401);
    });

    it('returns 400 for missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/api/voice-messages/presign')
        .send({})
        .expect(401); // JWT guard fires first
    });
  });

  // ── POST /api/voice-messages/messages/:messageId/confirm ──────────────────

  describe('POST /api/voice-messages/messages/:messageId/confirm', () => {
    it('returns 401 without auth token', async () => {
      await request(app.getHttpServer())
        .post('/api/voice-messages/messages/00000000-0000-0000-0000-000000000001/confirm')
        .send({
          fileKey: 'voice/user/msg/file.ogg',
          fileSize: 51200,
          duration: 30,
        })
        .expect(401);
    });
  });

  // ── GET /api/voice-messages/:id ───────────────────────────────────────────

  describe('GET /api/voice-messages/:id', () => {
    it('returns 401 without auth token', async () => {
      await request(app.getHttpServer())
        .get('/api/voice-messages/00000000-0000-0000-0000-000000000001')
        .expect(401);
    });

    it('returns 400 for invalid UUID', async () => {
      await request(app.getHttpServer())
        .get('/api/voice-messages/not-a-uuid')
        .expect(400);
    });
  });

  // ── GET /api/voice-messages/messages/:messageId ───────────────────────────

  describe('GET /api/voice-messages/messages/:messageId', () => {
    it('returns 401 without auth token', async () => {
      await request(app.getHttpServer())
        .get('/api/voice-messages/messages/00000000-0000-0000-0000-000000000001')
        .expect(401);
    });
  });

  // ── DELETE /api/voice-messages/:id ────────────────────────────────────────

  describe('DELETE /api/voice-messages/:id', () => {
    it('returns 401 without auth token', async () => {
      await request(app.getHttpServer())
        .delete('/api/voice-messages/00000000-0000-0000-0000-000000000001')
        .expect(401);
    });
  });
});
