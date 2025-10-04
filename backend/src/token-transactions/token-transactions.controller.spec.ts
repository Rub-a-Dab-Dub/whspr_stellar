import { Test, TestingModule } from '@nestjs/testing';
import { TokenTransactionsController } from './token-transactions.controller';
import { TokenTransactionsService } from './token-transactions.service';

describe('TokenTransactionsController', () => {
  let controller: TokenTransactionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TokenTransactionsController],
      providers: [TokenTransactionsService],
    }).compile();

    controller = module.get<TokenTransactionsController>(TokenTransactionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
