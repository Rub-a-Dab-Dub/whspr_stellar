import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FeeSponsorshipController } from './fee-sponsorship.controller';
import { FeeSponsorshipService } from './fee-sponsorship.service';

describe('FeeSponsorshipController', () => {
  let controller: FeeSponsorshipController;
  let service: { getRemainingQuota: jest.Mock; getSponsorshipHistory: jest.Mock };

  const uid = 'u1';

  beforeEach(async () => {
    service = {
      getRemainingQuota: jest.fn().mockResolvedValue({ eligible: true, remaining: 10 }),
      getSponsorshipHistory: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeeSponsorshipController],
      providers: [{ provide: FeeSponsorshipService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(FeeSponsorshipController);
  });

  it('getQuota', async () => {
    await controller.getQuota(uid);
    expect(service.getRemainingQuota).toHaveBeenCalledWith(uid);
  });

  it('getHistory', async () => {
    await controller.getHistory(uid, '2', '5');
    expect(service.getSponsorshipHistory).toHaveBeenCalledWith(uid, 2, 5);
  });
});
