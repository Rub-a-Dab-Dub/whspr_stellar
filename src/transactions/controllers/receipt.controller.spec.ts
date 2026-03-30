import { Test } from '@nestjs/testing';
import { ReceiptController } from './receipt.controller';
import { ReceiptService } from '../services/receipt.service';

describe('ReceiptController', () => {
  let controller: ReceiptController;
  const receiptService = {
    getReceiptUrl: jest.fn(),
    exportTransactionHistory: jest.fn(),
    getExportStatus: jest.fn(),
    getExportDownloadUrl: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ReceiptController],
      providers: [{ provide: ReceiptService, useValue: receiptService }],
    }).compile();

    controller = moduleRef.get(ReceiptController);
    jest.clearAllMocks();
  });

  it('delegates receipt endpoint to service', async () => {
    receiptService.getReceiptUrl.mockResolvedValue({
      transactionId: 'tx-1',
      url: 'https://signed/receipt',
      expiresAt: new Date().toISOString(),
    });

    const result = await controller.getReceipt('u1', 'GUSER1', 'tx-1');

    expect(receiptService.getReceiptUrl).toHaveBeenCalledWith('u1', 'tx-1', 'GUSER1');
    expect(result.transactionId).toBe('tx-1');
  });

  it('delegates export creation endpoint to service', async () => {
    receiptService.exportTransactionHistory.mockResolvedValue({
      jobId: 'job-1',
      status: 'queued',
    });

    const result = await controller.exportTransactions(
      'u1',
      'GUSER1',
      { token: 'XLM' },
    );

    expect(receiptService.exportTransactionHistory).toHaveBeenCalledWith(
      'u1',
      { token: 'XLM' },
      'GUSER1',
    );
    expect(result.jobId).toBe('job-1');
  });

  it('delegates export status endpoint to service', async () => {
    receiptService.getExportStatus.mockResolvedValue({
      jobId: 'job-1',
      status: 'completed',
      downloadUrl: 'https://signed/export',
      expiresAt: new Date().toISOString(),
    });

    const result = await controller.getExportStatus('u1', 'job-1');

    expect(receiptService.getExportStatus).toHaveBeenCalledWith('u1', 'job-1');
    expect(result.status).toBe('completed');
  });

  it('delegates export download endpoint to service', async () => {
    receiptService.getExportDownloadUrl.mockResolvedValue({
      transactionId: 'job-1',
      url: 'https://signed/export',
      expiresAt: new Date().toISOString(),
    });

    const result = await controller.downloadExport('u1', 'job-1');

    expect(receiptService.getExportDownloadUrl).toHaveBeenCalledWith('u1', 'job-1');
    expect(result.url).toBe('https://signed/export');
  });
});
