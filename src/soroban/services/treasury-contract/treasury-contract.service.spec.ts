import { Test, TestingModule } from '@nestjs/testing';
import { TreasuryContractService } from './treasury-contract.service';

describe('TreasuryContractService', () => {
  let service: TreasuryContractService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TreasuryContractService],
    }).compile();

    service = module.get<TreasuryContractService>(TreasuryContractService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
