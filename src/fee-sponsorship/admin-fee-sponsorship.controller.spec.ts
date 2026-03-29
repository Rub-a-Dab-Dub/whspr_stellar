import { Test, TestingModule } from '@nestjs/testing';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminFeeSponsorshipController } from './admin-fee-sponsorship.controller';
import { FeeSponsorshipService } from './fee-sponsorship.service';

describe('AdminFeeSponsorshipController', () => {
  let controller: AdminFeeSponsorshipController;
  let service: { configureQuota: jest.Mock };

  beforeEach(async () => {
    service = {
      configureQuota: jest.fn().mockResolvedValue({
        silverQuota: 50,
        goldQuota: 20,
        blackQuota: 0,
        newUserDays: 30,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminFeeSponsorshipController],
      providers: [{ provide: FeeSponsorshipService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AdminFeeSponsorshipController);
  });

  it('configure delegates', async () => {
    const r = await controller.configure({ silverQuota: 60 });
    expect(service.configureQuota).toHaveBeenCalledWith({ silverQuota: 60 });
    expect(r.silverQuota).toBe(50);
  });
});
