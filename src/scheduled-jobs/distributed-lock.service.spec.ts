import { ConfigService } from '@nestjs/config';
import { DistributedLockService } from './distributed-lock.service';
import { RedisService } from '../common/redis/redis.service';

const mockUsing = jest.fn();

jest.mock('redlock', () =>
  jest.fn().mockImplementation(() => ({
    using: mockUsing,
  })),
);

describe('DistributedLockService', () => {
  let service: DistributedLockService;
  let mockRedisService: RedisService;

  beforeEach(() => {
    jest.clearAllMocks();

    const config = {
      get: jest.fn().mockImplementation((_key: string, defaultValue?: unknown) => defaultValue),
    } as unknown as ConfigService;

    mockRedisService = {
      getClient: jest.fn().mockReturnValue({}),
    } as unknown as RedisService;

    service = new DistributedLockService(mockRedisService, config);
  });

  it('executes function under lock when lock is acquired', async () => {
    mockUsing.mockImplementation(async (_resources, _ttl, callback) => callback());
    const fn = jest.fn().mockResolvedValue(undefined);

    const result = await service.runWithLock('job-a', 1000, fn);

    expect(result).toEqual({ executed: true });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('returns executed false when lock cannot be acquired', async () => {
    const executionError = new Error('locked');
    executionError.name = 'ExecutionError';
    mockUsing.mockRejectedValueOnce(executionError);

    const result = await service.runWithLock('job-b', 1000, jest.fn());

    expect(result).toEqual({ executed: false });
  });

  it('rethrows non-lock errors', async () => {
    mockUsing.mockRejectedValueOnce(new Error('redis down'));

    await expect(service.runWithLock('job-c', 1000, jest.fn())).rejects.toThrow('redis down');
  });
});
