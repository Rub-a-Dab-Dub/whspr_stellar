import { Test, TestingModule } from '@nestjs/testing';
import { KycWebhookService } from './kyc-webhook.service';

describe('KycWebhookService', () => {
  let service: KycWebhookService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KycWebhookService],
    }).compile();

    service = module.get<KycWebhookService>(KycWebhookService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
