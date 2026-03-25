import { ConfigService } from '@nestjs/config';
import { RedisHealthIndicator } from './redis.health.indicator';

const mockConnect = jest.fn();
const mockPing = jest.fn();
const mockDisconnect = jest.fn();

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    ping: mockPing,
    disconnect: mockDisconnect,
  })),
);

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;

  beforeEach(() => {
    jest.clearAllMocks();
    const config = {
      get: jest.fn().mockImplementation((_k: string, defaultValue: unknown) => defaultValue),
    } as unknown as ConfigService;
    indicator = new RedisHealthIndicator(config);
  });

  it('returns healthy status when redis replies PONG', async () => {
    mockConnect.mockResolvedValueOnce(undefined);
    mockPing.mockResolvedValueOnce('PONG');

    const result = await indicator.isHealthy('redis');
    expect(result).toEqual({ redis: { status: 'up' } });
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('throws health check error when redis is unavailable', async () => {
    mockConnect.mockRejectedValueOnce(new Error('cannot connect'));
    await expect(indicator.isHealthy('redis')).rejects.toThrow('Redis readiness check failed');
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
