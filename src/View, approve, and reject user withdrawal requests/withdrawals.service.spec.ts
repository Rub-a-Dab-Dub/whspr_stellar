import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { WithdrawalsService } from './withdrawals.service';
import {
  WithdrawalRequest,
  WithdrawalStatus,
  ChainType,
} from './entities/withdrawal-request.entity';
import { RiskScoringService } from './services/risk-scoring.service';
import { AuditLogService } from './services/audit-log.service';
import { NotificationService } from './services/notification.service';
import { BlockchainQueueService } from './services/blockchain-queue.service';
import { AuditAction } from './entities/withdrawal-audit-log.entity';

const mockRequest = (overrides = {}): WithdrawalRequest => ({
  id: 'req-uuid-1',
  userId: 'user-uuid-1',
  username: 'alice',
  walletAddress: '0xAbc123',
  amount: 500,
  chain: ChainType.ETH,
  status: WithdrawalStatus.PENDING,
  riskScore: 20,
  isNewAddress: false,
  autoApproved: false,
  rejectionReason: null,
  reviewedBy: null,
  reviewedAt: null,
  txHash: null,
  requestedAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const mockAdmin = {
  id: 'admin-1',
  username: 'admin_bob',
  ipAddress: '127.0.0.1',
};

describe('WithdrawalsService', () => {
  let service: WithdrawalsService;
  let withdrawalRepo: any;
  let auditLogService: any;
  let notificationService: any;
  let blockchainQueueService: any;
  let riskScoringService: any;

  beforeEach(async () => {
    withdrawalRepo = {
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
        getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
      }),
    };

    auditLogService = {
      log: jest.fn().mockResolvedValue({}),
      findByWithdrawalId: jest.fn(),
    };
    notificationService = {
      notifyUser: jest.fn().mockResolvedValue(undefined),
    };
    blockchainQueueService = {
      enqueue: jest.fn().mockResolvedValue({ jobId: 'job-1' }),
    };
    riskScoringService = {
      assessRisk: jest
        .fn()
        .mockResolvedValue({ score: 20, isNewAddress: false, flags: [] }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawalsService,
        {
          provide: getRepositoryToken(WithdrawalRequest),
          useValue: withdrawalRepo,
        },
        { provide: RiskScoringService, useValue: riskScoringService },
        { provide: AuditLogService, useValue: auditLogService },
        { provide: NotificationService, useValue: notificationService },
        { provide: BlockchainQueueService, useValue: blockchainQueueService },
      ],
    }).compile();

    service = module.get<WithdrawalsService>(WithdrawalsService);
    process.env.AUTO_APPROVE_WITHDRAWAL_THRESHOLD = '100';
  });

  describe('createRequest', () => {
    it('should create a pending request for amounts above threshold', async () => {
      const dto = {
        userId: 'user-1',
        username: 'alice',
        walletAddress: '0xAbc',
        amount: 500,
        chain: ChainType.ETH,
      };
      const created = mockRequest({ amount: 500 });
      withdrawalRepo.create.mockReturnValue(created);
      withdrawalRepo.save.mockResolvedValue(created);

      const result = await service.createRequest(dto);

      expect(result.status).toBe(WithdrawalStatus.PENDING);
      expect(blockchainQueueService.enqueue).not.toHaveBeenCalled();
    });

    it('should auto-approve requests below threshold with low risk', async () => {
      const dto = {
        userId: 'user-1',
        username: 'alice',
        walletAddress: '0xAbc',
        amount: 50,
        chain: ChainType.ETH,
      };
      const created = mockRequest({ amount: 50 });
      const queued = mockRequest({
        amount: 50,
        status: WithdrawalStatus.QUEUED,
        autoApproved: true,
      });
      withdrawalRepo.create.mockReturnValue(created);
      withdrawalRepo.save.mockResolvedValue(created);
      withdrawalRepo.findOne.mockResolvedValue(queued);

      const result = await service.createRequest(dto);

      expect(blockchainQueueService.enqueue).toHaveBeenCalledWith(created);
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.AUTO_APPROVED }),
      );
      expect(notificationService.notifyUser).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'WITHDRAWAL_QUEUED' }),
      );
    });

    it('should NOT auto-approve if risk score is >= 30 even below threshold', async () => {
      riskScoringService.assessRisk.mockResolvedValue({
        score: 50,
        isNewAddress: true,
        flags: ['NEW_WALLET_ADDRESS'],
      });
      const dto = {
        userId: 'user-1',
        username: 'alice',
        walletAddress: '0xNew',
        amount: 50,
        chain: ChainType.ETH,
      };
      const created = mockRequest({ amount: 50, riskScore: 50 });
      withdrawalRepo.create.mockReturnValue(created);
      withdrawalRepo.save.mockResolvedValue(created);

      await service.createRequest(dto);
      expect(blockchainQueueService.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('approveRequest', () => {
    it('should approve a pending request', async () => {
      const pending = mockRequest();
      const approved = mockRequest({
        status: WithdrawalStatus.QUEUED,
        reviewedBy: mockAdmin.id,
      });
      withdrawalRepo.findOne
        .mockResolvedValueOnce(pending)
        .mockResolvedValueOnce(approved);

      const result = await service.approveRequest('req-uuid-1', mockAdmin);

      expect(blockchainQueueService.enqueue).toHaveBeenCalledWith(pending);
      expect(withdrawalRepo.update).toHaveBeenCalledWith(
        'req-uuid-1',
        expect.objectContaining({ status: WithdrawalStatus.QUEUED }),
      );
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.APPROVED,
          adminId: mockAdmin.id,
        }),
      );
      expect(notificationService.notifyUser).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'WITHDRAWAL_APPROVED' }),
      );
    });

    it('should throw NotFoundException for unknown request', async () => {
      withdrawalRepo.findOne.mockResolvedValue(null);
      await expect(service.approveRequest('bad-id', mockAdmin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if request is not pending', async () => {
      withdrawalRepo.findOne.mockResolvedValue(
        mockRequest({ status: WithdrawalStatus.REJECTED }),
      );
      await expect(
        service.approveRequest('req-uuid-1', mockAdmin),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('rejectRequest', () => {
    it('should reject a pending request with reason', async () => {
      const pending = mockRequest();
      const rejected = mockRequest({
        status: WithdrawalStatus.REJECTED,
        rejectionReason: 'Suspicious',
      });
      withdrawalRepo.findOne
        .mockResolvedValueOnce(pending)
        .mockResolvedValueOnce(rejected);

      const result = await service.rejectRequest(
        'req-uuid-1',
        { reason: 'Suspicious' },
        mockAdmin,
      );

      expect(withdrawalRepo.update).toHaveBeenCalledWith(
        'req-uuid-1',
        expect.objectContaining({
          status: WithdrawalStatus.REJECTED,
          rejectionReason: 'Suspicious',
        }),
      );
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.REJECTED,
          reason: 'Suspicious',
        }),
      );
      expect(notificationService.notifyUser).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'WITHDRAWAL_REJECTED',
          reason: 'Suspicious',
        }),
      );
    });
  });
});
