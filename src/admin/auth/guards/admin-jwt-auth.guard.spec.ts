import { AdminJwtAuthGuard } from './admin-jwt-auth.guard';

describe('AdminJwtAuthGuard', () => {
  it('is defined and exposes canActivate', () => {
    const guard = new AdminJwtAuthGuard();
    expect(guard).toBeDefined();
    expect(typeof (guard as any).canActivate).toBe('function');
  });
});
