import { HealthController } from './health.controller';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis.health.indicator';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheck: jest.Mocked<HealthCheckService>;
  let db: jest.Mocked<TypeOrmHealthIndicator>;
  let redis: jest.Mocked<RedisHealthIndicator>;

  beforeEach(() => {
    healthCheck = {
      check: jest.fn(),
    } as unknown as jest.Mocked<HealthCheckService>;

    db = {
      pingCheck: jest.fn(),
    } as unknown as jest.Mocked<TypeOrmHealthIndicator>;

    redis = {
      isHealthy: jest.fn(),
    } as unknown as jest.Mocked<RedisHealthIndicator>;

    controller = new HealthController(healthCheck, db, redis);
  });

  it('returns live status always', () => {
    const result = controller.live();
    expect(result.status).toBe('ok');
    expect(result.timestamp).toBeDefined();
  });

  it('checks database and redis for readiness', async () => {
    healthCheck.check.mockResolvedValueOnce({ status: 'ok' } as any);
    db.pingCheck.mockResolvedValue({ database: { status: 'up' } } as any);
    redis.isHealthy.mockResolvedValue({ redis: { status: 'up' } } as any);

    const result = await controller.ready();
    expect(result).toEqual({ status: 'ok' });
    expect(healthCheck.check).toHaveBeenCalledTimes(1);
  });

  it('propagates readiness failure as 503 from terminus', async () => {
    healthCheck.check.mockRejectedValueOnce(new Error('dependency down'));
    await expect(controller.ready()).rejects.toThrow('dependency down');
  });
});
