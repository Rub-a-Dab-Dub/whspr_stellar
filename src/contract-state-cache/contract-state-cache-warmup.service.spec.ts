import { Logger } from '@nestjs/common';
import { ContractStateCacheWarmupService } from './contract-state-cache-warmup.service';

describe('ContractStateCacheWarmupService', () => {
  const origEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = origEnv;
  });

  it('skips warm when NODE_ENV is test', () => {
    process.env.NODE_ENV = 'test';
    const warm = jest.fn();
    const svc = new ContractStateCacheWarmupService(
      { get: jest.fn().mockReturnValue('true') } as any,
      { warmCache: warm } as any,
    );
    svc.onModuleInit();
    expect(warm).not.toHaveBeenCalled();
  });

  it('does not warm when CONTRACT_CACHE_WARM_ON_STARTUP is disabled', () => {
    process.env.NODE_ENV = 'development';
    const warm = jest.fn();
    const svc = new ContractStateCacheWarmupService(
      { get: jest.fn().mockReturnValue('false') } as any,
      { warmCache: warm } as any,
    );
    svc.onModuleInit();
    expect(warm).not.toHaveBeenCalled();
  });

  it('logs warning when warm fails', async () => {
    process.env.NODE_ENV = 'development';
    const warm = jest.fn().mockRejectedValue(new Error('warm failed'));
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const svc = new ContractStateCacheWarmupService(
      { get: jest.fn().mockReturnValue('true') } as any,
      { warmCache: warm } as any,
    );
    svc.onModuleInit();
    await new Promise((r) => setImmediate(r));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('warm failed'));
    warn.mockRestore();
  });

  it('schedules warm when not in test env and CONTRACT_CACHE_WARM_ON_STARTUP is true', async () => {
    process.env.NODE_ENV = 'development';
    const warm = jest.fn().mockResolvedValue({
      warmed: 1,
      skipped: 0,
      durationMs: 0,
      timedOut: false,
    });
    const svc = new ContractStateCacheWarmupService(
      { get: jest.fn().mockReturnValue('true') } as any,
      { warmCache: warm } as any,
    );
    svc.onModuleInit();
    await new Promise((r) => setImmediate(r));
    expect(warm).toHaveBeenCalledWith({ userLimit: 1000, maxDurationMs: 60_000 });
  });
});
