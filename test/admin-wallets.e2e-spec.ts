import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';

import { AdminWalletsController } from '../src/admin/controllers/admin-wallets.controller';
import { AdminWalletsService } from '../src/admin/services/admin-wallets.service';
import { RoleGuard } from '../src/roles/guards/role.guard';

describe('AdminWalletsController (e2e)', () => {
  let app: INestApplication;

  const mockService = {
    listWallets: jest.fn(),
    getWalletDetail: jest.fn(),
    retryWalletCreation: jest.fn(),
    syncWallets: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AdminWalletsController],
      providers: [{ provide: AdminWalletsService, useValue: mockService }],
    })
      .overrideGuard(RoleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /admin/wallets returns paginated wallets', async () => {
    const payload = {
      items: [
        {
          userId: 'u1',
          username: 'alice',
          walletAddress: '0xabc',
          chain: 'stellar',
          balance: '12.1',
          lastSyncedAt: null,
          createdAt: new Date().toISOString(),
          status: 'active',
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    };
    mockService.listWallets.mockResolvedValue(payload);

    const response = await request(app.getHttpServer())
      .get('/admin/wallets')
      .query({ page: 1, limit: 20, sortBy: 'createdAt' })
      .expect(200);

    expect(response.body.total).toBe(1);
    expect(mockService.listWallets).toHaveBeenCalled();
  });

  it('GET /admin/wallets/:walletAddress returns wallet detail', async () => {
    mockService.getWalletDetail.mockResolvedValue({
      userId: 'u1',
      walletAddress: '0xabc',
      transactions: [],
    });

    await request(app.getHttpServer())
      .get('/admin/wallets/0xabc')
      .expect(200);

    expect(mockService.getWalletDetail).toHaveBeenCalled();
  });

  it('POST /admin/wallets/:userId/retry-creation requeues wallet job', async () => {
    mockService.retryWalletCreation.mockResolvedValue({
      jobId: 'job-123',
      status: 'queued',
    });

    const response = await request(app.getHttpServer())
      .post('/admin/wallets/u1/retry-creation')
      .expect(201);

    expect(response.body.jobId).toBe('job-123');
  });

  it('POST /admin/wallets/sync starts sync job', async () => {
    mockService.syncWallets.mockResolvedValue({
      jobId: 'sync-123',
      queuedWallets: 4,
    });

    const response = await request(app.getHttpServer())
      .post('/admin/wallets/sync')
      .send({ chain: 'stellar' })
      .expect(201);

    expect(response.body.queuedWallets).toBe(4);
  });
});
