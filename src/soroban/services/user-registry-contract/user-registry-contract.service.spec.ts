import { Test, TestingModule } from '@nestjs/testing';
import { UserRegistryContractService } from './user-registry-contract.service';

describe('UserRegistryContractService', () => {
  let service: UserRegistryContractService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserRegistryContractService],
    }).compile();

    service = module.get<UserRegistryContractService>(UserRegistryContractService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
