import { Test, TestingModule } from '@nestjs/testing';
import { ContractStateCacheController } from './contract-state-cache.controller';
import { ContractStateCacheService } from './contract-state-cache.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

describe('ContractStateCacheController', () => {
  let controller: ContractStateCacheController;
  const svc = {
    getCacheStats: jest.fn(),
    warmCache: jest.fn(),
    invalidate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContractStateCacheController],
      providers: [{ provide: ContractStateCacheService, useValue: svc }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(ContractStateCacheController);
  });

  it('stats delegates', async () => {
    svc.getCacheStats.mockResolvedValue({ postgresRowCount: 1 });
    await expect(controller.stats()).resolves.toEqual({ postgresRowCount: 1 });
  });

  it('warm delegates', async () => {
    svc.warmCache.mockResolvedValue({ warmed: 2 });
    await expect(controller.warm({} as any)).resolves.toEqual({ warmed: 2 });
    expect(svc.warmCache).toHaveBeenCalledWith({});
  });

  it('invalidate decodes contract param', async () => {
    svc.invalidate.mockResolvedValue({ postgresRowsRemoved: 3 });
    await expect(controller.invalidate(encodeURIComponent('CA'))).resolves.toEqual({
      postgresRowsRemoved: 3,
    });
    expect(svc.invalidate).toHaveBeenCalledWith('CA');
  });
});
