import { NotFoundException, TooManyRequestsException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../common/redis/redis.service';
import { SandboxEnvironment } from './entities/sandbox-environment.entity';
import {
  SandboxTransaction,
  SandboxTransactionStatus,
  SandboxTransactionType,
} from './entities/sandbox-transaction.entity';
import { DeveloperSandboxService } from './developer-sandbox.service';

describe('DeveloperSandboxService', () => {
  let service: DeveloperSandboxService;

  const sandboxRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const sandboxTxRepo = {
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    find: jest.fn(),
  };

  const redisClient = {
    incr: jest.fn(),
    expire: jest.fn(),
  };

  const redisService = {
    getClient: jest.fn(() => redisClient),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeveloperSandboxService,
        { provide: getRepositoryToken(SandboxEnvironment), useValue: sandboxRepo },
        { provide: getRepositoryToken(SandboxTransaction), useValue: sandboxTxRepo },
        { provide: RedisService, useValue: redisService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string, fallback: string) => fallback) },
        },
      ],
    }).compile();

    service = module.get(DeveloperSandboxService);
    jest.clearAllMocks();
    redisClient.incr.mockResolvedValue(1);
    redisClient.expire.mockResolvedValue(1);
  });

  it('creates sandbox for a user', async () => {
    sandboxRepo.findOne.mockResolvedValue(null);
    sandboxRepo.create.mockImplementation((value: Partial<SandboxEnvironment>) => value);
    sandboxRepo.save.mockImplementation((value: Partial<SandboxEnvironment>) => ({
      id: 'sandbox-1',
      ...value,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const result = await service.createSandbox('user-1');

    expect(result.userId).toBe('user-1');
    expect(result.apiKeyId.startsWith('sbx_')).toBe(true);
  });

  it('throws when sandbox not found', async () => {
    sandboxRepo.findOne.mockResolvedValue(null);

    await expect(service.getSandbox('missing-user')).rejects.toThrow(NotFoundException);
  });

  it('resets sandbox by clearing wallets and transactions', async () => {
    sandboxRepo.findOne.mockResolvedValue({
      id: 'sandbox-1',
      userId: 'user-1',
      apiKeyId: 'sbx_abc',
      testWallets: [{ id: 'w-1' }],
    });
    sandboxRepo.save.mockImplementation((value: Partial<SandboxEnvironment>) => value);

    const result = await service.resetSandbox('user-1');

    expect(result.success).toBe(true);
    expect(result.completedInMs).toBeGreaterThanOrEqual(0);
    expect(sandboxTxRepo.delete).toHaveBeenCalled();
  });

  it('returns sandbox transactions flagged as sandbox', async () => {
    sandboxRepo.findOne.mockResolvedValue({
      id: 'sandbox-1',
      userId: 'user-1',
      apiKeyId: 'sbx_abc',
      testWallets: [],
    });
    sandboxTxRepo.find.mockResolvedValue([
      {
        id: 'tx-1',
        type: SandboxTransactionType.FRIEND_BOT_FUND,
        status: SandboxTransactionStatus.COMPLETED,
        isSandbox: true,
      },
    ]);

    const rows = await service.getSandboxTransactions('user-1');

    expect(rows).toHaveLength(1);
    expect(rows[0].isSandbox).toBe(true);
  });

  it('enforces daily sandbox limit', async () => {
    redisClient.incr.mockResolvedValue(1001);

    await expect(service.assertDailyApiLimit('user-1')).rejects.toThrow(TooManyRequestsException);
  });
});
