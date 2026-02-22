import { AdminJwtRefreshGuard } from './admin-jwt-refresh.guard';

describe('AdminJwtRefreshGuard', () => {
  it('is defined and exposes canActivate', () => {
    const guard = new AdminJwtRefreshGuard();
    expect(guard).toBeDefined();
    expect(typeof (guard as any).canActivate).toBe('function');
  });
});
