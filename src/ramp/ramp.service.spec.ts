import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
import { RampService } from './ramp.service';
import { RampTransaction, RampType, RampStatus } from './entities/ramp-transaction.entity';
import { WalletsRepository } from '../wallets/wallets.repository';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
});

const mockHttp = () => ({
  post: jest.fn(),
  get: jest.fn(),
});

const USER_ID = 'user-uuid';
const TX_ID = 'tx-uuid';
const ANCHOR_ID = 'anchor-123';
const ANCHOR_URL = 'https://anchor.example.com/sep24/interactive/abc';

const baseTx = (): RampTransaction =>
  ({
    id: TX_ID,
    userId: USER_ID,
    type: RampType.DEPOSIT,
    assetCode: 'USDC',
    amount: '100',
    fiatAmount: null,
    fiatCurrency: 'USD',
    status: RampStatus.PENDING,
    anchorId: ANCHOR_ID,
    anchorUrl: ANCHOR_URL,
    txHash: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }) as RampTransaction;

describe('RampService', () => {
  let service: RampService;
  let repo: ReturnType<typeof mockRepo>;
  let http: ReturnType<typeof mockHttp>;
  let walletsRepo: jest.Mocked<WalletsRepository>;

  beforeEach(async () => {
    repo = mockRepo();
    http = mockHttp();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RampService,
        { provide: getRepositoryToken(RampTransaction), useValue: repo },
        {
          provide: WalletsRepository,
          useValue: { findPrimaryByUserId: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            get: (k: string) =>
              ({ SEP24_ANCHOR_URL: 'https://anchor.example.com', SEP24_ANCHOR_API_KEY: 'key' })[k],
          },
        },
        { provide: HttpService, useValue: http },
      ],
    }).compile();

    service = module.get(RampService);
    walletsRepo = module.get(WalletsRepository);
  });

  describe('initDeposit', () => {
    it('calls anchor, saves tx, returns anchorUrl', async () => {
      http.post.mockReturnValue(of({ data: { id: ANCHOR_ID, url: ANCHOR_URL } }));
      const tx = baseTx();
      repo.create.mockReturnValue(tx);
      repo.save.mockResolvedValue(tx);

      const result = await service.initDeposit(USER_ID, { assetCode: 'USDC', amount: '100' });

      expect(http.post).toHaveBeenCalledWith(
        expect.stringContaining('deposit/interactive'),
        expect.objectContaining({ asset_code: 'USDC' }),
        expect.any(Object),
      );
      expect(repo.save).toHaveBeenCalled();
      expect(result.anchorUrl).toBe(ANCHOR_URL);
      expect(result.status).toBe(RampStatus.PENDING);
    });
  });

  describe('initWithdrawal', () => {
    it('throws BadRequestException when no primary wallet', async () => {
      (walletsRepo.findPrimaryByUserId as jest.Mock).mockResolvedValue(null);
      await expect(
        service.initWithdrawal(USER_ID, { assetCode: 'USDC', amount: '50' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('calls anchor with wallet address and saves tx', async () => {
      (walletsRepo.findPrimaryByUserId as jest.Mock).mockResolvedValue({
        walletAddress: 'GTEST...',
      });
      http.post.mockReturnValue(of({ data: { id: ANCHOR_ID, url: ANCHOR_URL } }));
      const tx = { ...baseTx(), type: RampType.WITHDRAWAL };
      repo.create.mockReturnValue(tx);
      repo.save.mockResolvedValue(tx);

      const result = await service.initWithdrawal(USER_ID, { assetCode: 'USDC', amount: '50' });
      expect(result.anchorUrl).toBe(ANCHOR_URL);
    });
  });

  describe('checkStatus', () => {
    it('throws NotFoundException for unknown tx', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.checkStatus(USER_ID, TX_ID)).rejects.toThrow(NotFoundException);
    });

    it('syncs from anchor and returns updated dto', async () => {
      const tx = baseTx();
      repo.findOne.mockResolvedValue(tx);
      http.get.mockReturnValue(
        of({ data: { transaction: { status: 'completed', stellar_transaction_id: 'hash123' } } }),
      );
      repo.save.mockResolvedValue({ ...tx, status: RampStatus.COMPLETED, txHash: 'hash123' });

      const result = await service.checkStatus(USER_ID, TX_ID);
      expect(repo.save).toHaveBeenCalled();
      expect(result.id).toBe(TX_ID);
    });

    it('skips anchor sync for terminal status', async () => {
      const tx = { ...baseTx(), status: RampStatus.COMPLETED };
      repo.findOne.mockResolvedValue(tx);

      await service.checkStatus(USER_ID, TX_ID);
      expect(http.get).not.toHaveBeenCalled();
    });
  });

  describe('getTransactions', () => {
    it('returns mapped DTOs', async () => {
      repo.find.mockResolvedValue([baseTx()]);
      const result = await service.getTransactions(USER_ID);
      expect(result).toHaveLength(1);
      expect(result[0].assetCode).toBe('USDC');
    });
  });

  describe('handleCallback', () => {
    it('ignores payload without id', async () => {
      await service.handleCallback({});
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it('ignores unknown anchorId', async () => {
      repo.findOne.mockResolvedValue(null);
      await service.handleCallback({ id: 'unknown' });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('updates status from callback payload', async () => {
      const tx = baseTx();
      repo.findOne.mockResolvedValue(tx);
      repo.save.mockResolvedValue(tx);

      await service.handleCallback({ id: ANCHOR_ID, status: 'completed' });
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('pollPendingTransactions', () => {
    it('syncs all pending/processing transactions', async () => {
      const txs = [baseTx(), { ...baseTx(), id: 'tx-2', status: RampStatus.PROCESSING }];
      repo.find.mockResolvedValue(txs);
      http.get.mockReturnValue(of({ data: { transaction: { status: 'pending_anchor' } } }));
      repo.save.mockResolvedValue({});

      await service.pollPendingTransactions();
      expect(http.get).toHaveBeenCalledTimes(2);
    });
  });
});
