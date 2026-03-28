import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { AnchorService } from './anchor.service';
import { Anchor } from './entities/anchor.entity';
import { AnchorTransaction, AnchorTxStatus, AnchorTxType } from './entities/anchor-transaction.entity';
import { CacheService } from '../cache/cache.service';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockHttp = () => ({ get: jest.fn(), post: jest.fn() });

const mockCache = () => ({
  getOrSet: jest.fn((key: string, ttl: number, fn: () => Promise<unknown>) => fn()),
  del: jest.fn(),
});

const ANCHOR_ID = 'anchor-uuid';
const USER_ID = 'user-uuid';
const TX_ID = 'tx-uuid';

const baseAnchor = (): Anchor =>
  ({
    id: ANCHOR_ID,
    name: 'Test Anchor',
    homeDomain: 'anchor.example.com',
    currency: 'NGN',
    country: 'NG',
    supportedSEPs: ['24', '38'],
    isActive: true,
    logoUrl: null,
    feeStructure: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }) as Anchor;

const baseTx = (): AnchorTransaction =>
  ({
    id: TX_ID,
    userId: USER_ID,
    anchorId: ANCHOR_ID,
    anchor: baseAnchor(),
    type: AnchorTxType.DEPOSIT,
    assetCode: 'USDC',
    amount: '100',
    fiatAmount: null,
    fiatCurrency: 'NGN',
    stellarTxHash: null,
    anchorTxId: 'sep24-tx-id',
    status: AnchorTxStatus.PENDING,
    createdAt: new Date(),
  }) as AnchorTransaction;

describe('AnchorService', () => {
  let service: AnchorService;
  let anchorRepo: ReturnType<typeof mockRepo>;
  let txRepo: ReturnType<typeof mockRepo>;
  let http: ReturnType<typeof mockHttp>;
  let cache: ReturnType<typeof mockCache>;

  beforeEach(async () => {
    anchorRepo = mockRepo();
    txRepo = mockRepo();
    http = mockHttp();
    cache = mockCache();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnchorService,
        { provide: getRepositoryToken(Anchor), useValue: anchorRepo },
        { provide: getRepositoryToken(AnchorTransaction), useValue: txRepo },
        { provide: HttpService, useValue: http },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    service = module.get(AnchorService);
  });

  // ── discoverAnchors ──────────────────────────────────────────────────────────

  describe('discoverAnchors', () => {
    it('returns mapped anchor DTOs from DB', async () => {
      anchorRepo.find.mockResolvedValue([baseAnchor()]);
      const result = await service.discoverAnchors();
      expect(result).toHaveLength(1);
      expect(result[0].homeDomain).toBe('anchor.example.com');
    });

    it('uses cache.getOrSet with 1h TTL', async () => {
      anchorRepo.find.mockResolvedValue([]);
      await service.discoverAnchors();
      expect(cache.getOrSet).toHaveBeenCalledWith('anchors:all', 3600, expect.any(Function));
    });
  });

  // ── getAnchorInfo ────────────────────────────────────────────────────────────

  describe('getAnchorInfo', () => {
    it('returns anchor DTO for valid id', async () => {
      anchorRepo.findOne.mockResolvedValue(baseAnchor());
      const result = await service.getAnchorInfo(ANCHOR_ID);
      expect(result.id).toBe(ANCHOR_ID);
    });

    it('throws NotFoundException for unknown id', async () => {
      anchorRepo.findOne.mockResolvedValue(null);
      await expect(service.getAnchorInfo('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── getAnchorForCurrency ─────────────────────────────────────────────────────

  describe('getAnchorForCurrency', () => {
    it('returns anchors for given currency', async () => {
      anchorRepo.find.mockResolvedValue([baseAnchor()]);
      const result = await service.getAnchorForCurrency('NGN');
      expect(result[0].currency).toBe('NGN');
    });
  });

  // ── parseAndCacheToml ────────────────────────────────────────────────────────

  describe('parseAndCacheToml', () => {
    it('parses SUPPORTED_PROTOCOLS from stellar.toml', async () => {
      anchorRepo.findOne.mockResolvedValue(baseAnchor());
      anchorRepo.save.mockResolvedValue(baseAnchor());
      http.get.mockReturnValue(
        of({ data: 'SUPPORTED_PROTOCOLS = ["SEP-24", "SEP-38"]' }),
      );

      const result = await service.parseAndCacheToml(ANCHOR_ID);
      expect(anchorRepo.save).toHaveBeenCalled();
      expect(result.id).toBe(ANCHOR_ID);
    });

    it('throws NotFoundException for unknown anchor', async () => {
      anchorRepo.findOne.mockResolvedValue(null);
      await expect(service.parseAndCacheToml('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('gracefully handles toml fetch failure', async () => {
      anchorRepo.findOne.mockResolvedValue(baseAnchor());
      anchorRepo.save.mockResolvedValue(baseAnchor());
      http.get.mockImplementation(() => { throw new Error('network error'); });

      // Should not throw
      await expect(service.parseAndCacheToml(ANCHOR_ID)).resolves.toBeDefined();
    });
  });

  // ── getBestAnchorRate ────────────────────────────────────────────────────────

  describe('getBestAnchorRate', () => {
    it('returns sorted rates with NGN corridor first', async () => {
      const ngnAnchor = baseAnchor();
      const otherAnchor = { ...baseAnchor(), id: 'other-id', currency: 'KES', country: 'KE' } as Anchor;
      anchorRepo.find.mockResolvedValue([otherAnchor, ngnAnchor]);

      http.get.mockReturnValue(
        of({ data: { price: '0.0006', fee: { total: '1.5' } } }),
      );

      const result = await service.getBestAnchorRate('NGN', 'USDC', 100);
      expect(result.length).toBeGreaterThan(0);
      // NGN corridor should be first
      expect(result[0].fromCurrency).toBe('NGN');
    });

    it('skips anchors that fail rate fetch', async () => {
      anchorRepo.find.mockResolvedValue([baseAnchor()]);
      http.get.mockImplementation(() => { throw new Error('timeout'); });

      const result = await service.getBestAnchorRate('NGN', 'USDC');
      expect(result).toHaveLength(0);
    });
  });

  // ── initiateDeposit ──────────────────────────────────────────────────────────

  describe('initiateDeposit', () => {
    it('creates tx and returns interactiveUrl', async () => {
      anchorRepo.findOne.mockResolvedValue(baseAnchor());
      http.post.mockReturnValue(
        of({ data: { id: 'sep24-id', url: 'https://anchor.example.com/interactive' } }),
      );
      const tx = baseTx();
      txRepo.create.mockReturnValue(tx);
      txRepo.save.mockResolvedValue(tx);

      const result = await service.initiateDeposit(USER_ID, ANCHOR_ID, {
        assetCode: 'USDC',
        amount: '100',
        fiatCurrency: 'NGN',
      });

      expect(result.interactiveUrl).toBe('https://anchor.example.com/interactive');
      expect(result.status).toBe(AnchorTxStatus.PENDING);
    });

    it('throws NotFoundException for inactive anchor', async () => {
      anchorRepo.findOne.mockResolvedValue(null);
      await expect(
        service.initiateDeposit(USER_ID, 'bad-id', { assetCode: 'USDC' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── initiateWithdrawal ───────────────────────────────────────────────────────

  describe('initiateWithdrawal', () => {
    it('creates withdrawal tx', async () => {
      anchorRepo.findOne.mockResolvedValue(baseAnchor());
      http.post.mockReturnValue(
        of({ data: { id: 'sep24-id', url: 'https://anchor.example.com/interactive' } }),
      );
      const tx = { ...baseTx(), type: AnchorTxType.WITHDRAWAL };
      txRepo.create.mockReturnValue(tx);
      txRepo.save.mockResolvedValue(tx);

      const result = await service.initiateWithdrawal(USER_ID, ANCHOR_ID, {
        assetCode: 'USDC',
        amount: '50',
      });

      expect(result.status).toBe(AnchorTxStatus.PENDING);
    });

    it('throws BadRequestException when amount is missing', async () => {
      anchorRepo.findOne.mockResolvedValue(baseAnchor());
      await expect(
        service.initiateWithdrawal(USER_ID, ANCHOR_ID, { assetCode: 'USDC', amount: '' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── pollTransactionStatus ────────────────────────────────────────────────────

  describe('pollTransactionStatus', () => {
    it('throws NotFoundException for unknown tx', async () => {
      txRepo.findOne.mockResolvedValue(null);
      await expect(service.pollTransactionStatus('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('syncs from anchor for non-terminal status', async () => {
      const tx = baseTx();
      txRepo.findOne.mockResolvedValue(tx);
      http.get.mockReturnValue(
        of({ data: { transaction: { status: 'completed', stellar_transaction_id: 'hash123' } } }),
      );
      txRepo.save.mockResolvedValue({ ...tx, status: AnchorTxStatus.COMPLETED });

      const result = await service.pollTransactionStatus(TX_ID);
      expect(txRepo.save).toHaveBeenCalled();
      expect(result.id).toBe(TX_ID);
    });

    it('skips sync for terminal status', async () => {
      const tx = { ...baseTx(), status: AnchorTxStatus.COMPLETED };
      txRepo.findOne.mockResolvedValue(tx);

      await service.pollTransactionStatus(TX_ID);
      expect(http.get).not.toHaveBeenCalled();
    });
  });

  // ── pollAllPending ───────────────────────────────────────────────────────────

  describe('pollAllPending', () => {
    it('syncs all pending and processing transactions', async () => {
      const txs = [
        baseTx(),
        { ...baseTx(), id: 'tx-2', status: AnchorTxStatus.PROCESSING },
      ];
      txRepo.find.mockResolvedValue(txs);
      http.get.mockReturnValue(
        of({ data: { transaction: { status: 'pending_anchor' } } }),
      );
      txRepo.save.mockResolvedValue({});

      await service.pollAllPending();
      expect(http.get).toHaveBeenCalledTimes(2);
    });

    it('handles empty pending list gracefully', async () => {
      txRepo.find.mockResolvedValue([]);
      await expect(service.pollAllPending()).resolves.toBeUndefined();
    });
  });
});
