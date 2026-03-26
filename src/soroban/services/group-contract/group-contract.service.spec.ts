import { Test, TestingModule } from '@nestjs/testing';
import { GroupContractService } from './group-contract.service';

describe('GroupContractService', () => {
  let service: GroupContractService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GroupContractService],
    }).compile();

    service = module.get<GroupContractService>(GroupContractService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
