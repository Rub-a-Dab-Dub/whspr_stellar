import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException } from '@nestjs/common';
import {
  StellarHistoryImporterService,
  StellarTxRecord,
} from './stellar-history-importer.service';
import {
  HistoryImportJob,
  ImportJobStatus,
} from './entities/history-import-job.entity';
import { HISTORY_IMPORT_QUEUE } from './processors/history-import.processor';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTx(hash: string): StellarTxRecord {
  return {
    txHash: hash,
    ledger: 1000,
    createdAt: '2024-01-01T00:00:00Z',
    sourceAccount: 'GABCDE',
    feeCharged: '100',
    operationCount: 1,
    successful: true,
    envelopeXdr: 'envelope',
    resultXdr: 'result',
  };
}

function makeJob(overrides: Partial<HistoryImportJob> = {}): HistoryImportJob {
  return {
    id: 'job-uuid',
    walletId: 'wallet-uuid',
    status: ImportJobStatus.PENDING,
    totalImported: 0,
    cursor: undefined,
    errorMessage: undefined,
    startedAt: new Date('2024-01-01'),
    completedAt: undefined,
    ...overrides,
  } as HistoryImportJob;
}

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockJobRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  manager: { query: jest.fn() },
};

const mockQueue = { add: jest.fn() };
const mockEventEmitter = { emit: jest.fn() };
const mockConfigService = {
  get: jest.fn((key: string, def?: string) =>
    key === 'STELLAR_HORIZON_URL' ? 'https://horizon-testnet.stellar.org' : def,
  ),
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('StellarHistoryImporterService', () => {
  let service: StellarHistoryImporterService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarHistoryImporterService,
        { provide: getRepositoryToken(HistoryImportJob), useValue: mockJobRepo },
        { provide: getQueueToken(HISTORY_IMPORT_QUEUE), useValue: mockQueue },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get(StellarHistoryImporterService);
    jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined);
    jest.spyOn(service['logger'], 'error').mockImplementation(() => undefined);
  });

  // ── triggerImport ──────────────────────────────────────────────────────────

  describe('triggerImport', () => {
    it('creates a PENDING job and enqueues it', async () => {
      const job = makeJob();
      mockJobRepo.create.mockReturnValue(job);
      mockJobRepo.save.mockResolvedValue(job);
      mockJobRepo.update.mockResolvedValue(undefined);
      mockQueue.add.mockResolvedValue(undefined);

      const result = await service.triggerImport('wallet-uuid', 'GABC');

      expect(mockJobRepo.update).toHaveBeenCalledWith(
        { walletId: 'wallet-uuid', status: ImportJobStatus.RUNNING },
        expect.objectContaining({ status: ImportJobStatus.FAILED }),
      );
      expect(mockJobRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ walletId: 'wallet-uuid', status: ImportJobStatus.PENDING }),
      );
      expect(mockQueue.add).toHaveBeenCalledWith(
        'import',
        { jobId: job.id, walletId: 'wallet-uuid', walletAddress: 'GABC' },
        expect.any(Object),
      );
      expect(result).toBe(job);
    });
  });

  // ── importHistory ──────────────────────────────────────────────────────────

  describe('importHistory', () => {
    it('marks job RUNNING then COMPLETED when no transactions found', async () => {
      mockJobRepo.findOne.mockResolvedValue(makeJob());
      mockJobRepo.update.mockResolvedValue(undefined);
      jest.spyOn(service, 'fetchTransactionPage').mockResolvedValue([]);

      await service.importHistory('job-uuid', 'wallet-uuid', 'GABC');

      expect(mockJobRepo.update).toHaveBeenCalledWith('job-uuid', {
        status: ImportJobStatus.RUNNING,
      });
      expect(mockJobRepo.update).toHaveBeenCalledWith(
        'job-uuid',
        expect.objectContaining({ status: ImportJobStatus.COMPLETED }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'wallet.history.imported',
        expect.objectContaining({ walletId: 'wallet-uuid' }),
      );
    });

    it('imports all pages and persists them', async () => {
      const page1 = [makeTx('hash1'), makeTx('hash2')];
      mockJobRepo.findOne.mockResolvedValue(makeJob());
      mockJobRepo.update.mockResolvedValue(undefined);
      jest
        .spyOn(service, 'fetchTransactionPage')
        .mockResolvedValueOnce(page1)
        .mockResolvedValueOnce([]);
      jest.spyOn(service, 'deduplicateByTxHash').mockResolvedValue(page1);
      jest.spyOn(service as any, 'persistTransactions').mockResolvedValue(undefined);

      await service.importHistory('job-uuid', 'wallet-uuid', 'GABC');

      expect((service as any).persistTransactions).toHaveBeenCalledWith('wallet-uuid', page1);
      expect(mockJobRepo.update).toHaveBeenCalledWith(
        'job-uuid',
        expect.objectContaining({ status: ImportJobStatus.COMPLETED, totalImported: 2 }),
      );
    });

    it('marks job FAILED and rethrows on error', async () => {
      mockJobRepo.findOne.mockResolvedValue(makeJob());
      mockJobRepo.update.mockResolvedValue(undefined);
      jest.spyOn(service, 'fetchTransactionPage').mockRejectedValue(new Error('horizon down'));

      await expect(service.importHistory('job-uuid', 'wallet-uuid', 'GABC')).rejects.toThrow(
        'horizon down',
      );
      expect(mockJobRepo.update).toHaveBeenCalledWith(
        'job-uuid',
        expect.objectContaining({ status: ImportJobStatus.FAILED }),
      );
    });

    it('throws NotFoundException for unknown job', async () => {
      mockJobRepo.findOne.mockResolvedValue(null);
      await expect(service.importHistory('bad', 'wallet-uuid', 'GABC')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('resumes from saved cursor on retry', async () => {
      mockJobRepo.findOne.mockResolvedValue(makeJob({ cursor: 'cursor-abc', totalImported: 5 }));
      mockJobRepo.update.mockResolvedValue(undefined);
      const spy = jest.spyOn(service, 'fetchTransactionPage').mockResolvedValue([]);

      await service.importHistory('job-uuid', 'wallet-uuid', 'GABC');

      expect(spy).toHaveBeenCalledWith('GABC', 'cursor-abc');
    });
  });

  // ── mapHorizonTxToInternal ─────────────────────────────────────────────────

  describe('mapHorizonTxToInternal', () => {
    it('maps all fields correctly', () => {
      const raw = {
        hash: 'abc123',
        ledger: 999,
        created_at: '2024-06-01T12:00:00Z',
        source_account: 'GABCDE',
        fee_charged: '200',
        operation_count: 2,
        successful: true,
        memo: 'hello',
        envelope_xdr: 'xdr1',
        result_xdr: 'xdr2',
      };
      expect(service.mapHorizonTxToInternal(raw)).toEqual({
        txHash: 'abc123',
        ledger: 999,
        createdAt: '2024-06-01T12:00:00Z',
        sourceAccount: 'GABCDE',
        feeCharged: '200',
        operationCount: 2,
        successful: true,
        memo: 'hello',
        envelopeXdr: 'xdr1',
        resultXdr: 'xdr2',
      });
    });

    it('handles missing memo gracefully', () => {
      const raw = {
        hash: 'a', ledger: 1, created_at: '', source_account: 'G',
        fee_charged: '0', operation_count: 1, successful: true,
        envelope_xdr: '', result_xdr: '',
      };
      expect(service.mapHorizonTxToInternal(raw).memo).toBeUndefined();
    });
  });

  // ── deduplicateByTxHash ────────────────────────────────────────────────────

  describe('deduplicateByTxHash', () => {
    it('filters out already-imported hashes', async () => {
      mockJobRepo.manager.query.mockResolvedValue([{ txHash: 'hash1' }]);
      const result = await service.deduplicateByTxHash('wallet', [makeTx('hash1'), makeTx('hash2')]);
      expect(result).toHaveLength(1);
      expect(result[0].txHash).toBe('hash2');
    });

    it('returns all records when none exist in DB', async () => {
      mockJobRepo.manager.query.mockResolvedValue([]);
      const result = await service.deduplicateByTxHash('wallet', [makeTx('h1'), makeTx('h2')]);
      expect(result).toHaveLength(2);
    });

    it('returns all records when table does not exist yet', async () => {
      mockJobRepo.manager.query.mockRejectedValue(new Error('relation does not exist'));
      const result = await service.deduplicateByTxHash('wallet', [makeTx('h1')]);
      expect(result).toHaveLength(1);
    });

    it('returns empty array for empty input', async () => {
      const result = await service.deduplicateByTxHash('wallet', []);
      expect(result).toEqual([]);
    });
  });

  // ── getImportStatus ────────────────────────────────────────────────────────

  describe('getImportStatus', () => {
    it('returns DTO for the most recent job', async () => {
      const job = makeJob({ status: ImportJobStatus.COMPLETED, totalImported: 42 });
      mockJobRepo.findOne.mockResolvedValue(job);
      const result = await service.getImportStatus('wallet-uuid');
      expect(result.status).toBe(ImportJobStatus.COMPLETED);
      expect(result.totalImported).toBe(42);
    });

    it('throws NotFoundException when no job exists', async () => {
      mockJobRepo.findOne.mockResolvedValue(null);
      await expect(service.getImportStatus('wallet-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  // ── syncNewTransactions ────────────────────────────────────────────────────

  describe('syncNewTransactions', () => {
    it('syncs from last cursor and returns count', async () => {
      mockJobRepo.findOne.mockResolvedValue(
        makeJob({ status: ImportJobStatus.COMPLETED, cursor: 'cursor-xyz' }),
      );
      const txs = [makeTx('hashNew')];
      jest.spyOn(service, 'fetchTransactionPage').mockResolvedValue(txs);
      jest.spyOn(service, 'deduplicateByTxHash').mockResolvedValue(txs);
      jest.spyOn(service as any, 'persistTransactions').mockResolvedValue(undefined);

      const count = await service.syncNewTransactions('wallet-uuid', 'GABC');
      expect(service.fetchTransactionPage).toHaveBeenCalledWith('GABC', 'cursor-xyz');
      expect(count).toBe(1);
    });

    it('returns 0 when no new transactions', async () => {
      mockJobRepo.findOne.mockResolvedValue(null);
      jest.spyOn(service, 'fetchTransactionPage').mockResolvedValue([]);
      jest.spyOn(service, 'deduplicateByTxHash').mockResolvedValue([]);
      expect(await service.syncNewTransactions('wallet-uuid', 'GABC')).toBe(0);
    });
  });

  // ── resumeFromCursor ───────────────────────────────────────────────────────

  describe('resumeFromCursor', () => {
    it('calls importHistory with the stored walletId', async () => {
      mockJobRepo.findOne.mockResolvedValue(makeJob());
      const spy = jest.spyOn(service, 'importHistory').mockResolvedValue(undefined);
      await service.resumeFromCursor('job-uuid', 'GABC');
      expect(spy).toHaveBeenCalledWith('job-uuid', 'wallet-uuid', 'GABC');
    });

    it('throws NotFoundException for unknown job', async () => {
      mockJobRepo.findOne.mockResolvedValue(null);
      await expect(service.resumeFromCursor('bad', 'GABC')).rejects.toThrow(NotFoundException);
    });
  });
});
