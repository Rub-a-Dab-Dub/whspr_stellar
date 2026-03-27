import { Test, TestingModule } from '@nestjs/testing';
import { MessagingContractService } from './messaging-contract.service';

describe('MessagingContractService', () => {
  let service: MessagingContractService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MessagingContractService],
    }).compile();

    service = module.get<MessagingContractService>(MessagingContractService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
