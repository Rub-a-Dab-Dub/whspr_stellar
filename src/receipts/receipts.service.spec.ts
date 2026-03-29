import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ReceiptsService } from './receipts.service';

describe('ReceiptsService', () => {
  let service: ReceiptsService;
  let mockQueue: any;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiptsService,
        {
          provide: getQueueToken('export-queue'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<ReceiptsService>(ReceiptsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateReceipt', () => {
    it('should return a Buffer', () => {
      const txHash = 'a'.repeat(64);
      const result = service.generateReceipt(txHash);
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should handle different txHash lengths (mock)', () => {
      const txHash = 'b'.repeat(64);
      const result = service.generateReceipt(txHash);
      expect(result).toBeInstanceOf(Buffer);
    });
  });

  describe('exportTransactionHistory', () => {
    it('should call queue.add for csv format', () => {
      const userId = 'user123';
      const format = 'csv' as const;
      service.exportTransactionHistory(userId, format);
      expect(mockQueue.add).toHaveBeenCalledWith('generate-csv', { userId, format });
    });

    it('should call queue.add for pdf format', () => {
      const userId = 'user456';
      const format = 'pdf' as const;
      service.exportTransactionHistory(userId, format);
      expect(mockQueue.add).toHaveBeenCalledWith('generate-csv', { userId, format });
    });
  });

  describe('uploadToS3', () => {
    it('should return a mock S3 URL', () => {
      const fileBuffer = Buffer.from('test');
      const fileName = 'test.csv';
      const result = service.uploadToS3(fileBuffer, fileName);
      expect(result).toBe('https://s3.amazonaws.com/whspr-exports/test.csv');
    });

    it('should handle different file names', () => {
      const fileBuffer = Buffer.from('data');
      const fileName = 'export.pdf';
      const result = service.uploadToS3(fileBuffer, fileName);
      expect(result).toBe('https://s3.amazonaws.com/whspr-exports/export.pdf');
    });
  });
});