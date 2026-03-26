import { Test, TestingModule } from '@nestjs/testing';
import { TokenTransferContractService } from './token-transfer-contract.service';

describe('TokenTransferContractService', () => {
  let service: TokenTransferContractService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TokenTransferContractService],
    }).compile();

    service = module.get<TokenTransferContractService>(TokenTransferContractService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
