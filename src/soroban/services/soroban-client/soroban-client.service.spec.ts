import { Test, TestingModule } from '@nestjs/testing';
import { SorobanClientService } from './soroban-client.service';

describe('SorobanClientService', () => {
  let service: SorobanClientService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SorobanClientService],
    }).compile();

    service = module.get<SorobanClientService>(SorobanClientService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
