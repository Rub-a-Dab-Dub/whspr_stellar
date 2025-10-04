import { Test, TestingModule } from '@nestjs/testing';
import { PseudonymService } from './pseudonym.service';

describe('PseudonymService', () => {
  let service: PseudonymService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PseudonymService],
    }).compile();

    service = module.get<PseudonymService>(PseudonymService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
