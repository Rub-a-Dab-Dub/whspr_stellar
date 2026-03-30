import { Test, TestingModule } from '@nestjs/testing';
import { RevenueService } from './revenue.service';
import { RevenueRepository } from './revenue.repository';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RevenueRecord } from './entities/revenue-record.entity';
import { FeeDistribution } from './entities/fee-distribution.entity';

describe('RevenueService', () => {
  let service: RevenueService;
  let mockRepo: jest.Mocked<RevenueRepository>;

  beforeEach(async () => {
    const mockRevenueRecordRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockFeeDistributionRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RevenueService,
        {
          provide: RevenueRepository,
          useValue: {
            createRevenueRecord: jest.fn(),
            getRevenueSummary: jest.fn(),
            getUndistributedRevenue: jest.fn(),
            createDistribution: jest.fn(),
            getDistributionHistory: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RevenueService>(RevenueService);
    mockRepo = module.get(RevenueRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordRevenue', () => {
    it('should create revenue record', async () => {
      const mockRecord = { id: '1' } as RevenueRecord;
      mockRepo.createRevenueRecord.mockResolvedValue(mockRecord as any);

      const result = await service.recordRevenue(
        'TRANSFER_FEE' as any,
        'tx123',
        '100',
        'XLM',
        0.1,
      );

      expect(mockRepo.createRevenueRecord).toHaveBeenCalled();
      expect(result).toEqual(mockRecord);
    });
  });
});

