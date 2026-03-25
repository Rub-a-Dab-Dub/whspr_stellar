import { ConfigService } from '@nestjs/config';
import { DistributedLockService } from './distributed-lock.service';

const mockUsing = jest.fn();
const mockQuit = jest.fn();
const mockDisconnect = jest.fn();

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    quit: mockQuit,
    disconnect: mockDisconnect,
  })),
);

jest.mock('redlock', () =>
  jest.fn().mockImplementation(() => ({
    using: mockUsing,
  })),
);

describe('DistributedLockService', () => {
  let service: DistributedLockService;

  beforeEach(() => {
    jest.clearAllMocks();

    const config = {
      get: jest.fn().mockImplementation((_key: string, defaultValue?: unknown) => defaultValue),
    } as unknown as ConfigService;

    service = new DistributedLockService(config);
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

  it('disconnects redis on module destroy', async () => {
    mockQuit.mockResolvedValueOnce('OK');

    await service.onModuleDestroy();

    expect(mockQuit).toHaveBeenCalledTimes(1);
    expect(mockDisconnect).not.toHaveBeenCalled();
  });

  it('falls back to force disconnect when quit fails', async () => {
    mockQuit.mockRejectedValueOnce(new Error('quit failed'));

    await service.onModuleDestroy();

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });
});
