import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { IsAdminGuard } from './is-admin.guard';
import { UserRole } from '../../roles/entities/role.entity';

describe('IsAdminGuard', () => {
  let guard: IsAdminGuard;

  const makeContext = (user: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    guard = new IsAdminGuard();
  });

  it('returns false when request has no user', () => {
    expect(guard.canActivate(makeContext(undefined))).toBe(false);
  });

  it('allows direct admin role', () => {
    expect(guard.canActivate(makeContext({ role: UserRole.ADMIN }))).toBe(true);
  });

  it('allows nested user object role', () => {
    expect(
      guard.canActivate(makeContext({ user: { role: UserRole.SUPER_ADMIN } })),
    ).toBe(true);
  });

  it('allows admin role in roles array', () => {
    expect(
      guard.canActivate(
        makeContext({
          roles: [{ name: UserRole.MODERATOR }, { name: UserRole.ADMIN }],
        }),
      ),
    ).toBe(true);
  });

  it('throws forbidden for non-admin users', () => {
    expect(() =>
      guard.canActivate(makeContext({ role: UserRole.USER, roles: [] })),
    ).toThrow(ForbiddenException);
  });

  it('throws forbidden for non-admin retention access', () => {
    expect(() =>
      guard.canActivate(
        makeContext({
          user: { role: UserRole.USER, roles: [{ name: UserRole.USER }] },
        }),
      ),
    ).toThrow(ForbiddenException);
  });
});
