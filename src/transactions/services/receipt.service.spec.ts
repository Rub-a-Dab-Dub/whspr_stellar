import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { Wallet } from '../../wallets/entities/wallet.entity';
import { ReceiptService } from './receipt.service';
import { ReceiptPdfGenerator } from './receipt-pdf.generator';

const mockQueueAdd = jest.fn();
const mockQueueGetJob = jest.fn();
const mockQueueClose = jest.fn();
const mockQueueEventsClose = jest.fn();
const mockWorkerClose = jest.fn();
const mockS3Send = jest.fn();
const mockGetSignedUrl = jest.fn();
let capturedWorkerProcessor:
  | ((job: { name: string; data: Record<string, unknown> }) => Promise<{ fileKey: string }>)
  | null = null;

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    getJob: mockQueueGetJob,
    close: mockQueueClose,
  })),
  QueueEvents: jest.fn().mockImplementation(() => ({
    close: mockQueueEventsClose,
  })),
  Worker: jest.fn().mockImplementation((_name, processor) => {
    capturedWorkerProcessor = processor;
    return {
      processor,
      close: mockWorkerClose,
    };
  }),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: mockS3Send,
  })),
  PutObjectCommand: jest.fn().mockImplementation((input) => input),
  HeadObjectCommand: jest.fn().mockImplementation((input) => input),
  GetObjectCommand: jest.fn().mockImplementation((input) => input),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}));

describe('ReceiptService', () => {
  let service: ReceiptService;
  let walletsRepository: {
    find: jest.Mock;
    manager: { query: jest.Mock };
  };
  let pdfGenerator: { generate: jest.Mock };

  beforeEach(async () => {
    capturedWorkerProcessor = null;
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReceiptService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, fallback?: unknown) => {
              const config: Record<string, unknown> = {
                STORAGE_BUCKET: 'test-bucket',
              };
              return config[key] ?? fallback;
            }),
          },
        },
        {
          provide: getRepositoryToken(Wallet),
          useValue: {
            find: jest.fn(),
            manager: {
              query: jest.fn(),
            },
          },
        },
        {
          provide: ReceiptPdfGenerator,
          useValue: {
            generate: jest.fn().mockResolvedValue(Buffer.from('pdf-data')),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(ReceiptService);
    walletsRepository = moduleRef.get(getRepositoryToken(Wallet));
    pdfGenerator = moduleRef.get(ReceiptPdfGenerator);

    mockQueueAdd.mockReset();
    mockQueueGetJob.mockReset();
    mockQueueClose.mockReset();
    mockQueueEventsClose.mockReset();
    mockWorkerClose.mockReset();
    mockS3Send.mockReset();
    mockGetSignedUrl.mockReset();
    walletsRepository.find.mockReset();
    walletsRepository.manager.query.mockReset();
    pdfGenerator.generate.mockReset();
    pdfGenerator.generate.mockResolvedValue(Buffer.from('pdf-data'));
  });

  it('queues receipt generation and returns signed receipt URL', async () => {
    walletsRepository.find.mockResolvedValue([{ walletAddress: 'GUSER1' }]);
    walletsRepository.manager.query.mockResolvedValueOnce([
      {
        id: 'tx-1',
        txHash: 'hash1',
        fromAddress: 'GUSER1',
        toAddress: 'GUSER2',
        tokenId: 'XLM',
        amount: '12',
        fee: '0.1',
        status: 'CONFIRMED',
        type: 'TRANSFER',
        conversationId: 'conv-1',
        messageId: 'msg-1',
        network: 'stellar_testnet',
        ledger: '123',
        confirmedAt: new Date('2026-01-01T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    mockQueueGetJob.mockResolvedValue(null);
    mockQueueAdd.mockResolvedValue({
      id: 'receipt:u1:tx-1',
      waitUntilFinished: jest.fn().mockResolvedValue({ fileKey: 'receipts/u1/tx-1.pdf' }),
    });
    mockGetSignedUrl.mockResolvedValue('https://signed/receipt');

    const result = await service.generateReceipt('u1', 'tx-1', 'GUSER1');

    expect(mockQueueAdd).toHaveBeenCalledWith(
      'generate-receipt',
      { userId: 'u1', transactionId: 'tx-1', walletAddress: 'GUSER1' },
      { jobId: 'receipt:u1:tx-1' },
    );
    expect(result.transactionId).toBe('tx-1');
    expect(result.url).toBe('https://signed/receipt');
    expect(result.expiresAt).toBeDefined();
  });

  it('returns existing receipt URL when object already exists', async () => {
    walletsRepository.find.mockResolvedValue([{ walletAddress: 'GUSER1' }]);
    walletsRepository.manager.query.mockResolvedValueOnce([
      {
        id: 'tx-1',
        txHash: 'hash1',
        fromAddress: 'GUSER1',
        toAddress: 'GUSER2',
        tokenId: 'XLM',
        amount: '12',
        fee: '0.1',
        status: 'CONFIRMED',
        type: 'TRANSFER',
        conversationId: null,
        messageId: null,
        network: 'stellar_testnet',
        ledger: '123',
        confirmedAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    mockS3Send.mockResolvedValueOnce({});
    mockGetSignedUrl.mockResolvedValue('https://signed/existing');

    const result = await service.getReceiptUrl('u1', 'tx-1', 'GUSER1');

    expect(result.url).toBe('https://signed/existing');
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('generates receipt when file is missing from storage', async () => {
    walletsRepository.find.mockResolvedValue([{ walletAddress: 'GUSER1' }]);
    walletsRepository.manager.query.mockResolvedValue([
      {
        id: 'tx-2',
        txHash: 'hash2',
        fromAddress: 'GUSER1',
        toAddress: 'GUSER2',
        tokenId: 'USDC',
        amount: '5',
        fee: '0.01',
        status: 'PENDING',
        type: 'TRANSFER',
        conversationId: null,
        messageId: null,
        network: 'stellar_mainnet',
        ledger: null,
        confirmedAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    mockS3Send.mockRejectedValueOnce(new Error('missing'));
    mockQueueGetJob.mockResolvedValue(null);
    mockQueueAdd.mockResolvedValue({
      id: 'receipt:u1:tx-2',
      waitUntilFinished: jest.fn().mockResolvedValue({ fileKey: 'receipts/u1/tx-2.pdf' }),
    });
    mockGetSignedUrl.mockResolvedValue('https://signed/generated');

    const result = await service.getReceiptUrl('u1', 'tx-2', 'GUSER1');

    expect(mockQueueAdd).toHaveBeenCalledWith(
      'generate-receipt',
      { userId: 'u1', transactionId: 'tx-2', walletAddress: 'GUSER1' },
      { jobId: 'receipt:u1:tx-2' },
    );
    expect(result.url).toBe('https://signed/generated');
  });

  it('queues CSV export job and returns job id', async () => {
    mockQueueAdd.mockResolvedValue({ id: 'tx-export:u1:1700000000000' });

    const result = await service.exportTransactionHistory(
      'u1',
      { token: 'XLM', startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-02-01T00:00:00.000Z' },
      'GUSER1',
    );

    expect(mockQueueAdd).toHaveBeenCalledWith(
      'export-transactions',
      {
        userId: 'u1',
        filters: {
          token: 'XLM',
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-02-01T00:00:00.000Z',
        },
        walletAddress: 'GUSER1',
      },
      expect.objectContaining({ jobId: expect.stringContaining('tx-export:u1:') }),
    );
    expect(result.status).toBe('queued');
    expect(result.jobId).toContain('tx-export:u1:');
  });

  it('returns completed export status with one-hour signed URL', async () => {
    mockQueueGetJob.mockResolvedValue({
      data: { userId: 'u1' },
      getState: jest.fn().mockResolvedValue('completed'),
      returnvalue: { fileKey: 'exports/transactions/u1/file.csv' },
    });
    mockGetSignedUrl.mockResolvedValue('https://signed/export');

    const result = await service.getExportStatus('u1', 'job-123');

    expect(result.status).toBe('completed');
    expect(result.downloadUrl).toBe('https://signed/export');
    expect(result.expiresAt).toBeDefined();
  });

  it('rejects export status lookup for another user job', async () => {
    mockQueueGetJob.mockResolvedValue({
      data: { userId: 'other-user' },
      getState: jest.fn().mockResolvedValue('completed'),
      returnvalue: { fileKey: 'exports/transactions/other/file.csv' },
    });

    await expect(service.getExportStatus('u1', 'job-123')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns queued state when export job is not found in completed/failed states', async () => {
    mockQueueGetJob.mockResolvedValue({
      data: { userId: 'u1' },
      getState: jest.fn().mockResolvedValue('waiting'),
      returnvalue: {},
    });

    const result = await service.getExportStatus('u1', 'job-queued');

    expect(result.status).toBe('queued');
  });

  it('throws when export job does not exist', async () => {
    mockQueueGetJob.mockResolvedValue(null);
    await expect(service.getExportStatus('u1', 'missing')).rejects.toThrow('Export job not found');
  });

  it('returns failed export status with reason', async () => {
    mockQueueGetJob.mockResolvedValue({
      data: { userId: 'u1' },
      getState: jest.fn().mockResolvedValue('failed'),
      failedReason: 'boom',
    });

    const result = await service.getExportStatus('u1', 'job-failed');

    expect(result.status).toBe('failed');
    expect(result.error).toBe('boom');
  });

  it('throws when export date range is invalid', async () => {
    await expect(
      service.exportTransactionHistory(
        'u1',
        { startDate: '2026-03-01T00:00:00.000Z', endDate: '2026-01-01T00:00:00.000Z' },
        'GUSER1',
      ),
    ).rejects.toThrow('startDate must be before or equal to endDate');
  });

  it('throws when export download is requested before completion', async () => {
    mockQueueGetJob.mockResolvedValue({
      data: { userId: 'u1' },
      getState: jest.fn().mockResolvedValue('active'),
      returnvalue: {},
    });

    await expect(service.getExportDownloadUrl('u1', 'job-active')).rejects.toThrow(
      'Export is not ready for download',
    );
  });

  it('worker processor generates and uploads receipt PDF', async () => {
    expect(capturedWorkerProcessor).toBeTruthy();
    walletsRepository.find.mockResolvedValue([{ walletAddress: 'GUSER1' }]);
    walletsRepository.manager.query.mockResolvedValueOnce([
      {
        id: 'tx-3',
        txHash: 'hash3',
        fromAddress: 'GUSER1',
        toAddress: 'GUSER2',
        tokenId: 'XLM',
        amount: '22',
        fee: '0.1',
        status: 'CONFIRMED',
        type: 'TRANSFER',
        conversationId: 'conv-3',
        messageId: 'msg-3',
        network: 'stellar_testnet',
        ledger: '333',
        confirmedAt: new Date('2026-01-02T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    mockS3Send.mockResolvedValue({});

    const result = await capturedWorkerProcessor!(
      { name: 'generate-receipt', data: { userId: 'u1', transactionId: 'tx-3' } } as never,
    );

    expect(pdfGenerator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        txHash: 'hash3',
        explorerUrl: 'https://stellar.expert/explorer/testnet/tx/hash3',
      }),
    );
    expect(mockS3Send).toHaveBeenCalled();
    expect(result.fileKey).toBe('receipts/u1/tx-3.pdf');
  });

  it('worker processor exports CSV and uploads file', async () => {
    expect(capturedWorkerProcessor).toBeTruthy();
    walletsRepository.find.mockResolvedValue([{ walletAddress: 'GUSER1' }]);
    walletsRepository.manager.query.mockResolvedValueOnce([
      {
        id: 'tx-4',
        txHash: 'hash4',
        fromAddress: 'GUSER1',
        toAddress: 'GUSER2',
        tokenId: 'XLM',
        amount: '3',
        fee: '0.01',
        status: 'CONFIRMED',
        type: 'TIP',
        conversationId: null,
        messageId: null,
        network: 'stellar_mainnet',
        ledger: null,
        confirmedAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    mockS3Send.mockResolvedValue({});

    const result = await capturedWorkerProcessor!(
      {
        name: 'export-transactions',
        data: { userId: 'u1', filters: { token: 'XLM' } },
      } as never,
    );

    expect(mockS3Send).toHaveBeenCalled();
    expect(result.fileKey).toContain('exports/transactions/u1/');
    expect(result.fileKey).toContain('.csv');
  });

  it('waits for an existing queued receipt job', async () => {
    walletsRepository.find.mockResolvedValue([{ walletAddress: 'GUSER1' }]);
    walletsRepository.manager.query.mockResolvedValueOnce([
      {
        id: 'tx-queued',
        txHash: 'hash-queued',
        fromAddress: 'GUSER1',
        toAddress: 'GUSER2',
        tokenId: 'XLM',
        amount: '1',
        fee: '0.01',
        status: 'PENDING',
        type: 'TRANSFER',
        conversationId: null,
        messageId: null,
        network: 'stellar_mainnet',
        ledger: null,
        confirmedAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    mockQueueGetJob.mockResolvedValue({
      getState: jest.fn().mockResolvedValue('waiting'),
      waitUntilFinished: jest.fn().mockResolvedValue({ fileKey: 'receipts/u1/tx-queued.pdf' }),
    });
    mockGetSignedUrl.mockResolvedValue('https://signed/waited');

    const result = await service.generateReceipt('u1', 'tx-queued', 'GUSER1');
    expect(result.url).toBe('https://signed/waited');
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('throws for unsupported worker job names', async () => {
    await expect(
      capturedWorkerProcessor!({ name: 'unsupported-job', data: {} } as never),
    ).rejects.toThrow('Unsupported queue job: unsupported-job');
  });

  it('closes queue resources on module destroy', async () => {
    await service.onModuleDestroy();
    expect(mockWorkerClose).toHaveBeenCalled();
    expect(mockQueueEventsClose).toHaveBeenCalled();
    expect(mockQueueClose).toHaveBeenCalled();
  });
});
