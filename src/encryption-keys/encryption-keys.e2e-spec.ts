import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../app.module';
import { User } from '../users/entities/user.entity';
import { EncryptionKey, KeyType } from './entities/encryption-key.entity';
import { PreKeyBundle } from './entities/pre-key-bundle.entity';
import { SorobanKeyRegistryService } from './soroban-key-registry.service';

const PUBLIC_KEY_1 = 'base64encodedX25519key==';
const PUBLIC_KEY_2 = 'base64encodedEd25519key==';
const PREKEYS = [
  { keyId: 1, publicKey: 'prekey1==' },
  { keyId: 2, publicKey: 'prekey2==' },
];

describe('EncryptionKeysController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SorobanKeyRegistryService)
      .useValue({
        registerKey: jest.fn().mockResolvedValue(false),
        revokeKey: jest.fn().mockResolvedValue(false),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    const userRepo = dataSource.getRepository(User);
    const user = userRepo.create({
      walletAddress: '0xtest000000000000000000000000000000000ek1',
      username: 'enckeytestuser',
      isActive: true,
      isVerified: false,
    });
    const saved = await userRepo.save(user);
    userId = saved.id;

    authToken = jwtService.sign({ sub: userId, walletAddress: user.walletAddress });
  });

  afterEach(async () => {
    if (dataSource) {
      await dataSource.getRepository(PreKeyBundle).delete({ userId });
      await dataSource.getRepository(EncryptionKey).delete({ userId });
    }
  });

  afterAll(async () => {
    if (dataSource) {
      await dataSource.getRepository(User).delete({ id: userId });
    }
    await app.close();
  });

  // ─── POST /api/encryption/keys ────────────────────────────────────────────

  describe('POST /api/encryption/keys', () => {
    it('registers a new encryption key and returns 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/encryption/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ publicKey: PUBLIC_KEY_1, keyType: KeyType.X25519 })
        .expect(201);

      expect(res.body.userId).toBe(userId);
      expect(res.body.publicKey).toBe(PUBLIC_KEY_1);
      expect(res.body.keyType).toBe(KeyType.X25519);
      expect(res.body.version).toBe(1);
      expect(res.body.isActive).toBe(true);
      expect(res.body.registeredOnChain).toBe(false);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('createdAt');
    });

    it('registers key with prekey bundle', async () => {
      await request(app.getHttpServer())
        .post('/api/encryption/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ publicKey: PUBLIC_KEY_1, keyType: KeyType.X25519, preKeys: PREKEYS })
        .expect(201);

      const bundle = await dataSource
        .getRepository(PreKeyBundle)
        .findOne({ where: { userId, isValid: true } });
      expect(bundle).not.toBeNull();
      expect(bundle!.preKeys).toHaveLength(2);
    });

    it('returns 409 when active key already exists', async () => {
      await request(app.getHttpServer())
        .post('/api/encryption/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ publicKey: PUBLIC_KEY_1, keyType: KeyType.X25519 });

      return request(app.getHttpServer())
        .post('/api/encryption/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ publicKey: PUBLIC_KEY_2, keyType: KeyType.ED25519 })
        .expect(409);
    });

    it('returns 400 for missing publicKey', () => {
      return request(app.getHttpServer())
        .post('/api/encryption/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ keyType: KeyType.X25519 })
        .expect(400);
    });

    it('returns 400 for invalid keyType', () => {
      return request(app.getHttpServer())
        .post('/api/encryption/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ publicKey: PUBLIC_KEY_1, keyType: 'RSA2048' })
        .expect(400);
    });

    it('returns 401 without auth token', () => {
      return request(app.getHttpServer())
        .post('/api/encryption/keys')
        .send({ publicKey: PUBLIC_KEY_1, keyType: KeyType.X25519 })
        .expect(401);
    });
  });

  // ─── GET /api/encryption/keys/:userId ────────────────────────────────────

  describe('GET /api/encryption/keys/:userId', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/api/encryption/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ publicKey: PUBLIC_KEY_1, keyType: KeyType.X25519 });
    });

    it('returns the active key for a user', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/encryption/keys/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.userId).toBe(userId);
      expect(res.body.isActive).toBe(true);
      expect(res.body.publicKey).toBe(PUBLIC_KEY_1);
    });

    it('returns 404 when user has no active key', async () => {
      await dataSource.getRepository(EncryptionKey).delete({ userId });

      return request(app.getHttpServer())
        .get(`/api/encryption/keys/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('returns 400 for invalid UUID', () => {
      return request(app.getHttpServer())
        .get('/api/encryption/keys/not-a-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('returns 401 without auth token', () => {
      return request(app.getHttpServer())
        .get(`/api/encryption/keys/${userId}`)
        .expect(401);
    });
  });

  // ─── GET /api/encryption/keys/:userId/history ────────────────────────────

  describe('GET /api/encryption/keys/:userId/history', () => {
    it('returns full key history for decrypting old messages', async () => {
      await request(app.getHttpServer())
        .post('/api/encryption/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ publicKey: PUBLIC_KEY_1, keyType: KeyType.X25519 });

      await request(app.getHttpServer())
        .post('/api/encryption/keys/rotate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ publicKey: PUBLIC_KEY_2, keyType: KeyType.ED25519 });

      const res = await request(app.getHttpServer())
        .get(`/api/encryption/keys/${userId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
      // v2 active key first
      expect(res.body[0].version).toBe(2);
      expect(res.body[0].isActive).toBe(true);
      // v1 inactive key retained
      expect(res.body[1].version).toBe(1);
      expect(res.body[1].isActive).toBe(false);
    });

    it('returns empty array when user has no keys', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/encryption/keys/${userId}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });

  // ─── GET /api/encryption/keys/:userId/prekeys ─────────────────────────────

  describe('GET /api/encryption/keys/:userId/prekeys', () => {
    it('returns prekey bundle for offline key exchange', async () => {
      await request(app.getHttpServer())
        .post('/api/encryption/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ publicKey: PUBLIC_KEY_1, keyType: KeyType.X25519, preKeys: PREKEYS });

      const res = await request(app.getHttpServer())
        .get(`/api/encryption/keys/${userId}/prekeys`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(res.body.userId).toBe(userId);
      expect(res.body.isValid).toBe(true);
      expect(Array.isArray(res.body.preKeys)).toBe(true);
      expect(res.body.preKeys).toHaveLength(2);
    });

    it('returns 404 when no prekey bundle exists', () => {
      return request(app.getHttpServer())
        .get(`/api/encryption/keys/${userId}/prekeys`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  // ─── POST /api/encryption/keys/rotate ────────────────────────────────────

  describe('POST /api/encryption/keys/rotate', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/api/encryption/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ publicKey: PUBLIC_KEY_1, keyType: KeyType.X25519, preKeys: PREKEYS });
    });

    it('rotates to new key, incrementing version', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/encryption/keys/rotate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ publicKey: PUBLIC_KEY_2, keyType: KeyType.ED25519 })
        .expect(201);

      expect(res.body.version).toBe(2);
      expect(res.body.isActive).toBe(true);
      expect(res.body.publicKey).toBe(PUBLIC_KEY_2);
      expect(res.body.keyType).toBe(KeyType.ED25519);
    });

    it('only one active key exists after rotation', async () => {
      await request(app.getHttpServer())
        .post('/api/encryption/keys/rotate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ publicKey: PUBLIC_KEY_2, keyType: KeyType.ED25519 });

      const activeKeys = await dataSource
        .getRepository(EncryptionKey)
        .find({ where: { userId, isActive: true } });
      expect(activeKeys).toHaveLength(1);
      expect(activeKeys[0].publicKey).toBe(PUBLIC_KEY_2);
    });

    it('invalidates old prekey bundle on rotation', async () => {
      await request(app.getHttpServer())
        .post('/api/encryption/keys/rotate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ publicKey: PUBLIC_KEY_2, keyType: KeyType.ED25519 });

      const oldBundle = await dataSource
        .getRepository(PreKeyBundle)
        .findOne({ where: { userId, isValid: true } });
      // no new bundle provided, so none should be valid
      expect(oldBundle).toBeNull();
    });

    it('returns 404 when no active key exists to rotate', async () => {
      await dataSource.getRepository(PreKeyBundle).delete({ userId });
      await dataSource.getRepository(EncryptionKey).delete({ userId });

      return request(app.getHttpServer())
        .post('/api/encryption/keys/rotate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ publicKey: PUBLIC_KEY_2, keyType: KeyType.ED25519 })
        .expect(404);
    });

    it('returns 401 without auth token', () => {
      return request(app.getHttpServer())
        .post('/api/encryption/keys/rotate')
        .send({ publicKey: PUBLIC_KEY_2, keyType: KeyType.ED25519 })
        .expect(401);
    });
  });

  // ─── DELETE /api/encryption/keys ─────────────────────────────────────────

  describe('DELETE /api/encryption/keys', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/api/encryption/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ publicKey: PUBLIC_KEY_1, keyType: KeyType.X25519 });
    });

    it('revokes the active key and returns 204', async () => {
      await request(app.getHttpServer())
        .delete('/api/encryption/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      const key = await dataSource
        .getRepository(EncryptionKey)
        .findOne({ where: { userId, isActive: true } });
      expect(key).toBeNull();
    });

    it('key history is preserved after revocation', async () => {
      await request(app.getHttpServer())
        .delete('/api/encryption/keys')
        .set('Authorization', `Bearer ${authToken}`);

      const allKeys = await dataSource
        .getRepository(EncryptionKey)
        .find({ where: { userId } });
      expect(allKeys).toHaveLength(1);
      expect(allKeys[0].isActive).toBe(false);
    });

    it('returns 404 when no active key to revoke', async () => {
      // Revoke once
      await request(app.getHttpServer())
        .delete('/api/encryption/keys')
        .set('Authorization', `Bearer ${authToken}`);

      // Try again
      return request(app.getHttpServer())
        .delete('/api/encryption/keys')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('returns 401 without auth token', () => {
      return request(app.getHttpServer())
        .delete('/api/encryption/keys')
        .expect(401);
    });
  });
});
