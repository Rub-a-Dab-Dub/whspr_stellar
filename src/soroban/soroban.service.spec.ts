import { Test, TestingModule } from '@nestjs/testing';
import { SorobanService } from './soroban.service';

describe('SorobanService', () => {
  let service: SorobanService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SorobanService],
    }).compile();

    service = module.get<SorobanService>(SorobanService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
