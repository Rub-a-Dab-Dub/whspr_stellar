import { Test, TestingModule } from '@nestjs/testing';
import { TokenTransactionsService } from './token-transactions.service';

describe('TokenTransactionsService', () => {
  let service: TokenTransactionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TokenTransactionsService],
    }).compile();

    service = module.get<TokenTransactionsService>(TokenTransactionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
