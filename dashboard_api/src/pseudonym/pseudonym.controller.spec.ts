import { Test, TestingModule } from '@nestjs/testing';
import { PseudonymController } from './pseudonym.controller';
import { PseudonymService } from './pseudonym.service';

describe('PseudonymController', () => {
  let controller: PseudonymController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PseudonymController],
      providers: [PseudonymService],
    }).compile();

    controller = module.get<PseudonymController>(PseudonymController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
