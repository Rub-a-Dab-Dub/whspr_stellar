import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { ChainHealthIndicator } from './chain-health.indicator';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: HealthCheckService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn().mockImplementation((checks: any[]) => {
              return Promise.resolve({ status: 'ok', info: {}, error: {}, details: {} });
            }),
          },
        },
        {
          provide: TypeOrmHealthIndicator,
          useValue: { pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }) },
        },
        {
          provide: ChainHealthIndicator,
          useValue: { isHealthy: jest.fn().mockResolvedValue({ chains: { status: 'up' } }) },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get<HealthCheckService>(HealthCheckService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('liveness should return ok with no checks', async () => {
    const result = await controller.liveness();
    expect(result).toEqual({ status: 'ok', info: {}, error: {}, details: {} });
    expect(healthCheckService.check).toHaveBeenCalledWith([]);
  });

  it('readiness should invoke db and chain checks', async () => {
    const result = await controller.readiness();
    expect(result).toBeDefined();
    expect(healthCheckService.check).toHaveBeenCalled();
  });

  it('comprehensive should invoke all checks', async () => {
    const result = await controller.comprehensive();
    expect(result).toBeDefined();
    expect(healthCheckService.check).toHaveBeenCalled();
  });
});
