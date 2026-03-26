import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User, UserTier } from '../src/users/entities/user.entity';
import { Attachment } from '../src/attachments/entities/attachment.entity';
import { S3StorageService } from '../src/attachments/storage/s3-storage.service';

describe('AttachmentsController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;

  let userToken: string;
  let otherUserToken: string;
  let userId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = process.env.NODE_ENV || 'test';
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'test_jwt_secret_minimum_32_characters_long';
    process.env.DATABASE_HOST = process.env.DATABASE_HOST || 'localhost';
    process.env.DATABASE_PORT = process.env.DATABASE_PORT || '5432';
    process.env.DATABASE_USER = process.env.DATABASE_USER || 'postgres';
    process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD || 'postgres';
    process.env.DATABASE_NAME = process.env.DATABASE_NAME || 'gasless_gossip_test';
    process.env.EVM_RPC_URL = process.env.EVM_RPC_URL || 'https://example.com/rpc';
    process.env.EVM_PRIVATE_KEY =
      process.env.EVM_PRIVATE_KEY || '0x1111111111111111111111111111111111111111111111111111111111111111';
    process.env.EVM_ACCOUNT_ADDRESS =
      process.env.EVM_ACCOUNT_ADDRESS || '0x1111111111111111111111111111111111111111';
    process.env.EVM_CONTRACT_ADDRESS =
      process.env.EVM_CONTRACT_ADDRESS || '0x2222222222222222222222222222222222222222';
    process.env.STORAGE_BUCKET = process.env.STORAGE_BUCKET || 'test-bucket';
    process.env.STORAGE_ACCESS_KEY_ID = process.env.STORAGE_ACCESS_KEY_ID || 'test-key';
    process.env.STORAGE_SECRET_ACCESS_KEY =
      process.env.STORAGE_SECRET_ACCESS_KEY || 'test-secret';

    const { AppModule } = await import('../src/app.module');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(S3StorageService)
      .useValue({
        generateUploadUrl: jest.fn().mockResolvedValue('https://signed-upload-url'),
        resolveFileUrl: jest.fn((key: string) => `https://cdn.example.com/${key}`),
        deleteFile: jest.fn().mockResolvedValue(undefined),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    jwtService = moduleFixture.get(JwtService);

    const userRepository = dataSource.getRepository(User);

    const user = await userRepository.save(
      userRepository.create({
        walletAddress: '0xaaaabbbbccccddddeeeeffff0000111122223333',
        tier: UserTier.FREE,
        isActive: true,
      }),
    );
    userId = user.id;

    const otherUser = await userRepository.save(
      userRepository.create({
        walletAddress: '0xbbbbccccddddeeeeffff00001111222233334444',
        tier: UserTier.FREE,
        isActive: true,
      }),
    );

    userToken = jwtService.sign({
      sub: user.id,
      walletAddress: user.walletAddress,
    });
    otherUserToken = jwtService.sign({
      sub: otherUser.id,
      walletAddress: otherUser.walletAddress,
    });
  });

  afterAll(async () => {
    if (dataSource) {
      await dataSource.getRepository(Attachment).delete({});
      await dataSource.getRepository(User).delete({});
    }

    if (app) {
      await app.close();
    }
  });

  it('POST /attachments/presign returns 201 with 5-minute URL', async () => {
    await request(app.getHttpServer())
      .post('/api/attachments/presign')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        messageId: '123e4567-e89b-12d3-a456-426614174111',
        fileName: 'image.jpg',
        fileSize: 150000,
        mimeType: 'image/jpeg',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('uploadUrl');
        expect(res.body).toHaveProperty('fileKey');
        expect(res.body.expiresIn).toBe(300);
      });
  });

  it('POST /attachments/presign rejects unsupported MIME type', async () => {
    await request(app.getHttpServer())
      .post('/api/attachments/presign')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        messageId: '123e4567-e89b-12d3-a456-426614174111',
        fileName: 'malware.exe',
        fileSize: 150000,
        mimeType: 'application/x-msdownload',
      })
      .expect(400);
  });

  it('GET /attachments/:id returns attachment metadata', async () => {
    const attachmentRepository = dataSource.getRepository(Attachment);
    const created = await attachmentRepository.save(
      attachmentRepository.create({
        messageId: '123e4567-e89b-12d3-a456-426614174123',
        uploaderId: userId,
        fileUrl: 'https://cdn.example.com/uploads/x.jpg',
        fileKey: 'uploads/x.jpg',
        fileName: 'x.jpg',
        fileSize: 100,
        mimeType: 'image/jpeg',
      }),
    );

    await request(app.getHttpServer())
      .get(`/api/attachments/${created.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(created.id);
        expect(res.body.fileName).toBe('x.jpg');
      });
  });

  it('DELETE /attachments/:id deletes owned attachment', async () => {
    const attachmentRepository = dataSource.getRepository(Attachment);
    const created = await attachmentRepository.save(
      attachmentRepository.create({
        messageId: '123e4567-e89b-12d3-a456-426614174124',
        uploaderId: userId,
        fileUrl: 'https://cdn.example.com/uploads/y.jpg',
        fileKey: 'uploads/y.jpg',
        fileName: 'y.jpg',
        fileSize: 100,
        mimeType: 'image/jpeg',
      }),
    );

    await request(app.getHttpServer())
      .delete(`/api/attachments/${created.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(204);

    const found = await attachmentRepository.findOne({ where: { id: created.id } });
    expect(found).toBeNull();
  });

  it('DELETE /attachments/:id returns 403 for non-owner', async () => {
    const attachmentRepository = dataSource.getRepository(Attachment);
    const created = await attachmentRepository.save(
      attachmentRepository.create({
        messageId: '123e4567-e89b-12d3-a456-426614174125',
        uploaderId: userId,
        fileUrl: 'https://cdn.example.com/uploads/z.jpg',
        fileKey: 'uploads/z.jpg',
        fileName: 'z.jpg',
        fileSize: 100,
        mimeType: 'image/jpeg',
      }),
    );

    await request(app.getHttpServer())
      .delete(`/api/attachments/${created.id}`)
      .set('Authorization', `Bearer ${otherUserToken}`)
      .expect(403);
  });
});
