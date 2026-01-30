import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TransferService } from './transfer.service';
import { Transfer, TransferStatus, TransferType } from './entities/transfer.entity';
import { BulkTransfer } from './entities/bulk-transfer.entity';
import { TransferValidationService } from './services/transfer-validation.service';
import { TransferBalanceService } from './services/transfer-balance.service';
import { TransferBlockchainService } from './services/transfer-blockchain.service';
import { TransferNotificationService } from './services/transfer-notification.service';
import { UsersService } from '../user/user.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('TransferService', () => {
  let service: TransferService;
  let transferRepository: Repository<Transfer>;
  let bulkTransferRepository: Repository<BulkTransfer>;
  let validationService: TransferValidationService;
  let balanceService: TransferBalanceService;
  let blockchainService: TransferBlockchainService;
  let notificationService: TransferNotificationService;

  const mockTransferRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockBulkTransferRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockValidationService = {
    validateAmount: jest.fn(),
    validateRecipient: jest.fn(),
    validateBalance: jest.fn(),
    validateBulkTransfer: jest.fn(),
  };

  const mockBalanceService = {
    getBalance: jest.fn(),
    recordBalanceSnapshot: jest.fn(),
  };

  const mockBlockchainService = {
    executeTransfer: jest.fn(),
    getUserPublicKey: jest.fn(),
  };

  const mockNotificationService = {
    notifyTransferSent: jest.fn(),
    notifyTransferReceived: jest.fn(),
    notifyTransferFailed: jest.fn(),
    notifyBulkTransferComplete: jest.fn(),
  };

  const mockUsersService = {
    findById: jest.fn(),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransferService,
        {
          provide: getRepositoryToken(Transfer),
          useValue: mockTransferRepository,
        },
        {
          provide: getRepositoryToken(BulkTransfer),
          useValue: mockBulkTransferRepository,
        },
        {
          provide: TransferValidationService,
          useValue: mockValidationService,
        },
        {
          provide: TransferBalanceService,
          useValue: mockBalanceService,
        },
        {
          provide: TransferBlockchainService,
          useValue: mockBlockchainService,
        },
        {
          provide: TransferNotificationService,
          useValue: mockNotificationService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<TransferService>(TransferService);
    transferRepository = module.get<Repository<Transfer>>(getRepositoryToken(Transfer));
    bulkTransferRepository = module.get<Repository<BulkTransfer>>(getRepositoryToken(BulkTransfer));
    validationService = module.get<TransferValidationService>(TransferValidationService);
    balanceService = module.get<TransferBalanceService>(TransferBalanceService);
    blockchainService = module.get<TransferBlockchainService>(TransferBlockchainService);
    notificationService = module.get<TransferNotificationService>(TransferNotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTransfer', () => {
    it('should create a transfer successfully', async () => {
      const senderId = 'sender-uuid';
      const createTransferDto = {
        recipientId: 'recipient-uuid',
        amount: 100,
        memo: 'Test transfer',
        note: 'Internal note',
        blockchainNetwork: 'stellar',
      };

      const mockTransfer = {
        id: 'transfer-uuid',
        senderId,
        recipientId: createTransferDto.recipientId,
        amount: '100.00000000',
        status: TransferStatus.PENDING,
        type: TransferType.P2P,
      };

      mockValidationService.validateAmount.mockResolvedValue(undefined);
      mockValidationService.validateRecipient.mockResolvedValue(undefined);
      mockValidationService.validateBalance.mockResolvedValue(undefined);
      mockBalanceService.recordBalanceSnapshot.mockResolvedValue('500.00000000');
      mockTransferRepository.create.mockReturnValue(mockTransfer);
      mockTransferRepository.save.mockResolvedValue(mockTransfer);

      const result = await service.createTransfer(senderId, createTransferDto);

      expect(result).toEqual(mockTransfer);
      expect(mockValidationService.validateAmount).toHaveBeenCalledWith(100);
      expect(mockValidationService.validateRecipient).toHaveBeenCalledWith(
        createTransferDto.recipientId,
        senderId,
      );
      expect(mockValidationService.validateBalance).toHaveBeenCalledWith(
        senderId,
        100,
        'stellar',
      );
      expect(mockTransferRepository.save).toHaveBeenCalled();
    });

    it('should throw error for invalid amount', async () => {
      const senderId = 'sender-uuid';
      const createTransferDto = {
        recipientId: 'recipient-uuid',
        amount: -100,
        blockchainNetwork: 'stellar',
      };

      mockValidationService.validateAmount.mockImplementation(() => {
        throw new BadRequestException('Amount must be greater than zero');
      });

      await expect(service.createTransfer(senderId, createTransferDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error for insufficient balance', async () => {
      const senderId = 'sender-uuid';
      const createTransferDto = {
        recipientId: 'recipient-uuid',
        amount: 1000,
        blockchainNetwork: 'stellar',
      };

      mockValidationService.validateAmount.mockResolvedValue(undefined);
      mockValidationService.validateRecipient.mockResolvedValue(undefined);
      mockValidationService.validateBalance.mockImplementation(() => {
        throw new BadRequestException('Insufficient balance');
      });

      await expect(service.createTransfer(senderId, createTransferDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getTransferById', () => {
    it('should return transfer for authorized user', async () => {
      const transferId = 'transfer-uuid';
      const userId = 'user-uuid';
      const mockTransfer = {
        id: transferId,
        senderId: userId,
        recipientId: 'recipient-uuid',
        amount: '100.00000000',
      };

      mockTransferRepository.findOne.mockResolvedValue(mockTransfer);

      const result = await service.getTransferById(transferId, userId);

      expect(result).toEqual(mockTransfer);
      expect(mockTransferRepository.findOne).toHaveBeenCalledWith({
        where: { id: transferId },
        relations: ['sender', 'recipient'],
      });
    });

    it('should throw NotFoundException for non-existent transfer', async () => {
      const transferId = 'non-existent-uuid';
      const userId = 'user-uuid';

      mockTransferRepository.findOne.mockResolvedValue(null);

      await expect(service.getTransferById(transferId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for unauthorized user', async () => {
      const transferId = 'transfer-uuid';
      const userId = 'unauthorized-uuid';
      const mockTransfer = {
        id: transferId,
        senderId: 'sender-uuid',
        recipientId: 'recipient-uuid',
        amount: '100.00000000',
      };

      mockTransferRepository.findOne.mockResolvedValue(mockTransfer);

      await expect(service.getTransferById(transferId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
