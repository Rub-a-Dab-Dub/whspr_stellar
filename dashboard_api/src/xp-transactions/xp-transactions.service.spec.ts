import { Test, TestingModule } from '@nestjs/testing';
import { XpTransactionsService } from './xp-transactions.service';

describe('XpTransactionsService', () => {
  let service: XpTransactionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [XpTransactionsService],
    }).compile();

    service = module.get<XpTransactionsService>(XpTransactionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
