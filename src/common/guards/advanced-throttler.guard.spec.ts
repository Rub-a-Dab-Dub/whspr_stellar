import { AdvancedThrottlerGuard } from './advanced-throttler.guard';

describe('AdvancedThrottlerGuard', () => {
  let guard: AdvancedThrottlerGuard;

  beforeEach(() => {
    guard = new AdvancedThrottlerGuard(
      { throttlers: [] } as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('should generate tracker with user ID when authenticated', async () => {
    const req = {
      user: { id: 'user123' },
      ip: '127.0.0.1',
      method: 'GET',
      route: { path: '/api/test' },
      url: '/api/test',
    };
    const tracker = await (guard as any).getTracker(req);
    expect(tracker).toBe('user:user123:GET:/api/test');
  });

  it('should generate tracker with IP when not authenticated', async () => {
    const req = {
      ip: '127.0.0.1',
      method: 'POST',
      url: '/api/data',
    };
    const tracker = await (guard as any).getTracker(req);
    expect(tracker).toBe('ip:127.0.0.1:POST:/api/data');
  });
});
