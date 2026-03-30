import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeysService } from '../api-keys.service';
import { ApiKeyAuthGuard } from './api-key-auth.guard';

describe('ApiKeyAuthGuard', () => {
  let guard: ApiKeyAuthGuard;
  let reflector: jest.Mocked<Reflector>;
  let apiKeysService: jest.Mocked<ApiKeysService>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;
    apiKeysService = {
      validateApiKey: jest.fn(),
      trackUsage: jest.fn(),
    } as unknown as jest.Mocked<ApiKeysService>;

    guard = new ApiKeyAuthGuard(reflector, apiKeysService);
  });

  const makeContext = (headers: Record<string, string> = {}): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as unknown as ExecutionContext;

  it('skips when no API key is provided', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(makeContext())).resolves.toBe(true);
    expect(apiKeysService.validateApiKey).not.toHaveBeenCalled();
  });

  it('authenticates with x-api-key and enforces scopes', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(undefined).mockReturnValueOnce(['users:read']);
    apiKeysService.validateApiKey.mockResolvedValue({
      apiKey: {
        id: 'key-1',
        scopes: ['users:read'],
      } as ApiKey,
      user: {
        id: 'user-1',
        isActive: true,
      } as never,
    });

    const context = makeContext({ 'x-api-key': 'wsk_key-1.secret' });
    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(apiKeysService.validateApiKey).toHaveBeenCalledWith('wsk_key-1.secret', ['users:read']);
    expect(apiKeysService.trackUsage).toHaveBeenCalledWith('key-1');
  });
});
import { ApiKey } from '../entities/api-key.entity';
