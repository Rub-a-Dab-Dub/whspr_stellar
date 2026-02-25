import { RateLimitGuard } from './rate-limit.guard';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { UserRole } from '../user/entities/user.entity';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let cacheManager: any;
  let reflector: Reflector;

  const mockHeaders: Record<string, any> = {};
  const mockRes = { setHeader: jest.fn((k, v) => (mockHeaders[k] = v)) };

  function createContext(user?: any, ip = '127.0.0.1'): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user, ip, res: mockRes }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  }

  beforeEach(() => {
    cacheManager = { get: jest.fn().mockResolvedValue(null), set: jest.fn() };
    reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const configService = {
      get: jest.fn((key: string, def: number) => def),
    } as any;

    guard = new RateLimitGuard(reflector, configService, cacheManager);
    mockRes.setHeader.mockClear();
  });

  it('should allow requests under the limit', async () => {
    const ctx = createContext({ sub: 'user1', role: UserRole.USER });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 100);
  });

  it('should bypass for ADMIN role', async () => {
    const ctx = createContext({ sub: 'admin1', role: UserRole.ADMIN });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(cacheManager.get).not.toHaveBeenCalled();
  });

  it('should reject requests over the limit with 429', async () => {
    const now = Date.now();
    const entries = Array.from({ length: 100 }, (_, i) => now - i * 100);
    cacheManager.get.mockResolvedValue(entries);

    const ctx = createContext({ sub: 'user2', role: UserRole.USER });
    await expect(guard.canActivate(ctx)).rejects.toThrow(HttpException);
    try {
      await guard.canActivate(ctx);
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('should use IP-based limiting for unauthenticated requests', async () => {
    const ctx = createContext(undefined, '10.0.0.1');
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(cacheManager.get).toHaveBeenCalledWith('rl:ip:10.0.0.1');
  });

  it('should respect per-route decorator config', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({ limit: 5, windowMs: 10000 });
    const now = Date.now();
    const entries = Array.from({ length: 5 }, (_, i) => now - i * 100);
    cacheManager.get.mockResolvedValue(entries);

    const ctx = createContext({ sub: 'user3', role: UserRole.USER });
    await expect(guard.canActivate(ctx)).rejects.toThrow(HttpException);
  });
});
