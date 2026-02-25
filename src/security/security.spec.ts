import { IpBlockService } from './ip-block.service';
import { IpBlockGuard } from './ip-block.guard';
import { AuthThrottleService } from './auth-throttle.service';
import { ForbiddenException } from '@nestjs/common';

describe('IpBlockService', () => {
  let service: IpBlockService;
  const store: Record<string, any> = {};
  const cache = {
    get: jest.fn((k: string) => Promise.resolve(store[k])),
    set: jest.fn((k: string, v: any) => { store[k] = v; return Promise.resolve(); }),
    del: jest.fn((k: string) => { delete store[k]; return Promise.resolve(); }),
  };

  beforeEach(() => {
    service = new IpBlockService(cache as any);
    Object.keys(store).forEach((k) => delete store[k]);
  });

  it('should block and detect blocked IPs', async () => {
    await service.blockIp('1.2.3.4');
    expect(await service.isBlocked('1.2.3.4')).toBe(true);
  });

  it('should unblock IPs', async () => {
    await service.blockIp('1.2.3.4');
    await service.unblockIp('1.2.3.4');
    expect(await service.isBlocked('1.2.3.4')).toBe(false);
  });
});

describe('IpBlockGuard', () => {
  it('should throw ForbiddenException for blocked IPs', async () => {
    const ipBlockService = { isBlocked: jest.fn().mockResolvedValue(true) };
    const guard = new IpBlockGuard(ipBlockService as any);
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ ip: '1.2.3.4' }) }),
    } as any;
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should allow non-blocked IPs', async () => {
    const ipBlockService = { isBlocked: jest.fn().mockResolvedValue(false) };
    const guard = new IpBlockGuard(ipBlockService as any);
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ ip: '1.2.3.4' }) }),
    } as any;
    expect(await guard.canActivate(ctx)).toBe(true);
  });
});

describe('AuthThrottleService', () => {
  let service: AuthThrottleService;
  const store: Record<string, any> = {};
  const cache = {
    get: jest.fn((k: string) => Promise.resolve(store[k])),
    set: jest.fn((k: string, v: any) => { store[k] = v; return Promise.resolve(); }),
    del: jest.fn((k: string) => { delete store[k]; return Promise.resolve(); }),
  };

  beforeEach(() => {
    service = new AuthThrottleService(cache as any);
    Object.keys(store).forEach((k) => delete store[k]);
  });

  it('should record and increment failed attempts', async () => {
    const count = await service.recordFailedAttempt('5.6.7.8');
    expect(count).toBe(1);
  });

  it('should return 0 delay for 3 or fewer failures', async () => {
    expect(await service.getDelayMs('5.6.7.8')).toBe(0);
  });

  it('should return progressive delay after 3 failures', async () => {
    store['auth_fail:5.6.7.8'] = 5;
    const delay = await service.getDelayMs('5.6.7.8');
    expect(delay).toBe(2000); // 1000 * 2^(5-4) = 2000
  });

  it('should cap delay at 30s', async () => {
    store['auth_fail:5.6.7.8'] = 20;
    const delay = await service.getDelayMs('5.6.7.8');
    expect(delay).toBe(30000);
  });
});
