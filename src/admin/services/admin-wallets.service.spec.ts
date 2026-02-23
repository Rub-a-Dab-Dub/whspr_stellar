import { BadRequestException, ConflictException } from '@nestjs/common';
import { AdminWalletsService } from './admin-wallets.service';
import { AuditAction } from '../entities/audit-log.entity';

describe('AdminWalletsService', () => {
  const mockUserRepository: any = {
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const mockTransferRepository: any = {};
  const mockChainService: any = {};
  const mockAuditLogService = {
    createAuditLog: jest.fn(),
  };
  const mockWalletCreationQueue: any = {
    add: jest.fn(),
    getJobs: jest.fn(),
  };
  const mockBlockchainQueue: any = {
    add: jest.fn(),
    getJobs: jest.fn(),
  };

  let service: AdminWalletsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminWalletsService(
      mockUserRepository,
      mockTransferRepository,
      mockChainService,
      mockAuditLogService as any,
      mockWalletCreationQueue,
      mockBlockchainQueue,
    );
  });

  it('throws 409 when retry is requested for active wallet', async () => {
    mockUserRepository.findOne.mockResolvedValue({
      id: 'u-1',
      walletAddress: '0xabc',
    });

    await expect(
      service.retryWalletCreation('u-1', 'admin-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws 400 when retry is requested without failed status', async () => {
    mockUserRepository.findOne.mockResolvedValue({
      id: 'u-1',
      walletAddress: null,
    });
    mockWalletCreationQueue.getJobs.mockResolvedValue([]);

    await expect(
      service.retryWalletCreation('u-1', 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requeues failed wallet creation jobs', async () => {
    mockUserRepository.findOne.mockResolvedValue({
      id: 'u-1',
      walletAddress: null,
    });
    mockWalletCreationQueue.getJobs.mockResolvedValue([
      {
        id: 'job-1',
        data: { userId: 'u-1', chain: 'stellar' },
        failedReason: 'timeout',
        progress: () => 100,
        getState: jest.fn().mockResolvedValue('failed'),
      },
    ]);
    mockWalletCreationQueue.add.mockResolvedValue({ id: 'job-2' });

    const result = await service.retryWalletCreation('u-1', 'admin-1');
    expect(result).toEqual({ jobId: 'job-2', status: 'queued' });
    expect(mockAuditLogService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.RETRY_WALLET_CREATION,
      }),
    );
  });

  it('creates sync job and writes audit log', async () => {
    mockUserRepository.find.mockResolvedValue([
      { id: 'u-1', walletAddress: '0xabc' },
      { id: 'u-2', walletAddress: null },
    ]);
    mockBlockchainQueue.add.mockResolvedValue({ id: 'sync-1' });

    const result = await service.syncWallets(
      { userIds: ['u-1', 'u-2'], chain: 'stellar' },
      'admin-1',
    );

    expect(result).toEqual({ jobId: 'sync-1', queuedWallets: 1 });
    expect(mockAuditLogService.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.SYNC_WALLETS,
      }),
    );
  });
});
