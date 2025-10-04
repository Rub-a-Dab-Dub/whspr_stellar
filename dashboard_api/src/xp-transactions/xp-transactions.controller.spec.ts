import { Test, TestingModule } from '@nestjs/testing';
import { XpTransactionsController } from './xp-transactions.controller';
import { XpTransactionsService } from './xp-transactions.service';

describe('XpTransactionsController', () => {
  let controller: XpTransactionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [XpTransactionsController],
      providers: [XpTransactionsService],
    }).compile();

    controller = module.get<XpTransactionsController>(XpTransactionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
