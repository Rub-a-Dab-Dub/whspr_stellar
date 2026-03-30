import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BlockchainTransactionsService } from './blockchain-transactions.service';
import { BlockchainTransactionsRepository } from '../repositories/blockchain-transactions.repository';
import {
  BlockchainTransaction,
  BlockchainTransactionStatus,
  BlockchainTransactionType,
} from '../entities/blockchain-transaction.entity';

describe('BlockchainTransactionsService', () => {
  let service: BlockchainTransactionsService;
  let repository: BlockchainTransactionsRepository;

  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';
  const mockTransactionId = '550e8400-e29b-41d4-a716-446655440001';

  const mockTransaction: BlockchainTransaction = {
    id: mockTransactionId,
    userId: mockUserId,
    type: BlockchainTransactionType.TRANSFER,
    txHash: null,
    status: BlockchainTransactionStatus.PENDING,
    fromAddress: 'GAXYZ123...',
    toAddress: 'GAXYZ456...',
    amountUsdc: '100.0000000',
    feeStroops: null,
    ledger: null,
    errorMessage: null,
    referenceId: 'ref-123',
    createdAt: new Date(),
    confirmedAt: null,
    updatedAt: new Date(),
    user: undefined as any,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainTransactionsService,
        {
          provide: BlockchainTransactionsRepository,
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOneBy: jest.fn(),
            findByTxHash: jest.fn(),
            findByReferenceId: jest.fn(),
            findUserTransactionsPaginated: jest.fn(),
            count: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BlockchainTransactionsService>(BlockchainTransactionsService);
    repository = module.get<BlockchainTransactionsRepository>(BlockchainTransactionsRepository);
  });

  describe('createTransaction', () => {
    it('should create a new transaction in pending status', async () => {
      const dto = {
        userId: mockUserId,
        type: BlockchainTransactionType.DEPOSIT,
        fromAddress: 'GAXYZ123...',
        toAddress: 'GAXYZ456...',
        amountUsdc: '50.0000000',
        referenceId: 'ref-deposit-001',
      };

      jest.spyOn(repository, 'findByReferenceId').mockResolvedValue(null);
      jest.spyOn(repository, 'create').mockReturnValue(mockTransaction);
      jest.spyOn(repository, 'save').mockResolvedValue(mockTransaction);

      const result = await service.createTransaction(dto);

      expect(result.status).toBe(BlockchainTransactionStatus.PENDING);
      expect(result.txHash).toBeNull();
      expect(repository.create).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw error if referenceId already exists (idempotency check)', async () => {
      const dto = {
        userId: mockUserId,
        type: BlockchainTransactionType.DEPOSIT,
        fromAddress: 'GAXYZ123...',
        toAddress: 'GAXYZ456...',
        amountUsdc: '50.0000000',
        referenceId: 'ref-existing',
      };

      jest.spyOn(repository, 'findByReferenceId').mockResolvedValue(mockTransaction);

      await expect(service.createTransaction(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateTransactionStatus', () => {
    it('should update transaction status with txHash and set confirmedAt', async () => {
      const updateDto = {
        status: BlockchainTransactionStatus.CONFIRMED,
        txHash: 'abc123def456',
        ledger: 12345,
        feeStroops: 100,
      };

      const updatedTx = { ...mockTransaction, ...updateDto, confirmedAt: new Date() };

      jest.spyOn(repository, 'findOneBy').mockResolvedValue(mockTransaction);
      jest.spyOn(repository, 'save').mockResolvedValue(updatedTx);

      const result = await service.updateTransactionStatus(mockTransactionId, updateDto);

      expect(result.status).toBe(BlockchainTransactionStatus.CONFIRMED);
      expect(result.confirmedAt).not.toBeNull();
      expect(result.txHash).toBe('abc123def456');
      expect(result.ledger).toBe(12345);
    });

    it('should throw error if transaction not found', async () => {
      jest.spyOn(repository, 'findOneBy').mockResolvedValue(null);

      await expect(
        service.updateTransactionStatus(mockTransactionId, {
          status: BlockchainTransactionStatus.CONFIRMED,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error if txHash differs when already set', async () => {
      const txWithHash = { ...mockTransaction, txHash: 'original123' };

      jest.spyOn(repository, 'findOneBy').mockResolvedValue(txWithHash);

      await expect(
        service.updateTransactionStatus(mockTransactionId, {
          status: BlockchainTransactionStatus.CONFIRMED,
          txHash: 'different456',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should maintain idempotency with same txHash', async () => {
      const txWithHash = { ...mockTransaction, txHash: 'abc123' };

      jest.spyOn(repository, 'findOneBy').mockResolvedValue(txWithHash);
      jest.spyOn(repository, 'save').mockResolvedValue(txWithHash);

      const result = await service.updateTransactionStatus(mockTransactionId, {
        status: BlockchainTransactionStatus.CONFIRMED,
        txHash: 'abc123',
      });

      expect(result.txHash).toBe('abc123');
    });
  });

  describe('findByReferenceId', () => {
    it('should find transaction by reference ID', async () => {
      jest.spyOn(repository, 'findByReferenceId').mockResolvedValue(mockTransaction);

      const result = await service.findByReferenceId('ref-123');

      expect(result).toEqual(mockTransaction);
    });

    it('should return null if not found', async () => {
      jest.spyOn(repository, 'findByReferenceId').mockResolvedValue(null);

      const result = await service.findByReferenceId('ref-nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByTxHash', () => {
    it('should find transaction by blockchain hash', async () => {
      jest.spyOn(repository, 'findByTxHash').mockResolvedValue(mockTransaction);

      const result = await service.findByTxHash('abc123def456');

      expect(result).toEqual(mockTransaction);
    });
  });

  describe('getUserTransactions', () => {
    it('should return paginated list of user transactions with filtering', async () => {
      const query = { page: 1, limit: 10, type: BlockchainTransactionType.TRANSFER };
      const [transactions] = [[mockTransaction], 1];

      jest
        .spyOn(repository, 'findUserTransactionsPaginated')
        .mockResolvedValue([transactions, 1]);

      const result = await service.getUserTransactions(mockUserId, query);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });
  });

  describe('verifyUserOwnership', () => {
    it('should verify user owns the transaction', async () => {
      jest.spyOn(repository, 'findOneBy').mockResolvedValue(mockTransaction);

      const result = await service.verifyUserOwnership(mockTransactionId, mockUserId);

      expect(result).toBe(true);
    });

    it('should return false if user does not own transaction', async () => {
      const otherUserId = '550e8400-e29b-41d4-a716-446655440999';
      jest.spyOn(repository, 'findOneBy').mockResolvedValue(mockTransaction);

      const result = await service.verifyUserOwnership(mockTransactionId, otherUserId);

      expect(result).toBe(false);
    });

    it('should return false if transaction not found', async () => {
      jest.spyOn(repository, 'findOneBy').mockResolvedValue(null);

      const result = await service.verifyUserOwnership(mockTransactionId, mockUserId);

      expect(result).toBe(false);
    });
  });
});
