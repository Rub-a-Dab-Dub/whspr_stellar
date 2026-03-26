import { Test, TestingModule } from '@nestjs/testing';
import { KycProviderService } from './kyc-provider.service';

describe('KycProviderService', () => {
  let service: KycProviderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KycProviderService],
    }).compile();

    service = module.get<KycProviderService>(KycProviderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
