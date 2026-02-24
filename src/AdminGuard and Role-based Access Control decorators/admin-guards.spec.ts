import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AdminRoles,
  ADMIN_ROLES_KEY,
} from './decorators/admin-roles.decorator';
import {
  AdminRole,
  getRoleLevel,
  hasRequiredRole,
} from './enums/admin-role.enum';
import { AdminGuard } from './guards/admin.guard';
import { AdminRolesGuard } from './guards/admin-roles.guard';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function mockExecutionContext(user: any): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

// ─────────────────────────────────────────────
// Role hierarchy tests
// ─────────────────────────────────────────────

describe('AdminRole hierarchy', () => {
  it('SUPER_ADMIN has the highest level', () => {
    expect(getRoleLevel(AdminRole.SUPER_ADMIN)).toBeGreaterThan(
      getRoleLevel(AdminRole.ADMIN),
    );
    expect(getRoleLevel(AdminRole.ADMIN)).toBeGreaterThan(
      getRoleLevel(AdminRole.MODERATOR),
    );
  });

  it('SUPER_ADMIN satisfies ADMIN requirement', () => {
    expect(hasRequiredRole(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)).toBe(true);
  });

  it('SUPER_ADMIN satisfies MODERATOR requirement', () => {
    expect(hasRequiredRole(AdminRole.SUPER_ADMIN, AdminRole.MODERATOR)).toBe(
      true,
    );
  });

  it('ADMIN satisfies MODERATOR requirement', () => {
    expect(hasRequiredRole(AdminRole.ADMIN, AdminRole.MODERATOR)).toBe(true);
  });

  it('ADMIN does NOT satisfy SUPER_ADMIN requirement', () => {
    expect(hasRequiredRole(AdminRole.ADMIN, AdminRole.SUPER_ADMIN)).toBe(false);
  });

  it('MODERATOR does NOT satisfy ADMIN requirement', () => {
    expect(hasRequiredRole(AdminRole.MODERATOR, AdminRole.ADMIN)).toBe(false);
  });

  it('MODERATOR does NOT satisfy SUPER_ADMIN requirement', () => {
    expect(hasRequiredRole(AdminRole.MODERATOR, AdminRole.SUPER_ADMIN)).toBe(
      false,
    );
  });
});

// ─────────────────────────────────────────────
// AdminGuard tests
// ─────────────────────────────────────────────

describe('AdminGuard', () => {
  let guard: AdminGuard;

  beforeEach(() => {
    guard = new AdminGuard();
  });

  it('returns user when user is a valid admin', () => {
    const user = { id: '1', isAdmin: true, role: AdminRole.ADMIN };
    const result = guard.handleRequest(
      null,
      user,
      null,
      {} as ExecutionContext,
    );
    expect(result).toBe(user);
  });

  it('throws UnauthorizedException when user is falsy', () => {
    expect(() =>
      guard.handleRequest(null, null, null, {} as ExecutionContext),
    ).toThrow(UnauthorizedException);
  });

  it('throws ForbiddenException when isAdmin is false', () => {
    const user = { id: '1', isAdmin: false };
    expect(() =>
      guard.handleRequest(null, user, null, {} as ExecutionContext),
    ).toThrow(ForbiddenException);
  });

  it('re-throws existing errors', () => {
    const err = new Error('JWT malformed');
    expect(() =>
      guard.handleRequest(err, null, null, {} as ExecutionContext),
    ).toThrow(err);
  });
});

// ─────────────────────────────────────────────
// AdminRolesGuard tests
// ─────────────────────────────────────────────

describe('AdminRolesGuard', () => {
  let guard: AdminRolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new AdminRolesGuard(reflector);
  });

  function buildContext(
    user: any,
    roles: AdminRole[] | undefined,
  ): ExecutionContext {
    const ctx = mockExecutionContext(user);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles as any);
    return ctx;
  }

  // No roles metadata
  it('allows any admin when no roles metadata is set', () => {
    const ctx = buildContext({ role: AdminRole.MODERATOR }, undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows any admin when roles metadata is empty array', () => {
    const ctx = buildContext({ role: AdminRole.MODERATOR }, []);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  // MODERATOR routes
  it('allows MODERATOR on a MODERATOR-required route', () => {
    const ctx = buildContext({ role: AdminRole.MODERATOR }, [
      AdminRole.MODERATOR,
    ]);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows ADMIN on a MODERATOR-required route', () => {
    const ctx = buildContext({ role: AdminRole.ADMIN }, [AdminRole.MODERATOR]);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows SUPER_ADMIN on a MODERATOR-required route', () => {
    const ctx = buildContext({ role: AdminRole.SUPER_ADMIN }, [
      AdminRole.MODERATOR,
    ]);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  // ADMIN routes
  it('denies MODERATOR on an ADMIN-required route', () => {
    const ctx = buildContext({ role: AdminRole.MODERATOR }, [AdminRole.ADMIN]);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows ADMIN on an ADMIN-required route', () => {
    const ctx = buildContext({ role: AdminRole.ADMIN }, [AdminRole.ADMIN]);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows SUPER_ADMIN on an ADMIN-required route', () => {
    const ctx = buildContext({ role: AdminRole.SUPER_ADMIN }, [
      AdminRole.ADMIN,
    ]);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  // SUPER_ADMIN routes
  it('denies MODERATOR on a SUPER_ADMIN-required route', () => {
    const ctx = buildContext({ role: AdminRole.MODERATOR }, [
      AdminRole.SUPER_ADMIN,
    ]);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('denies ADMIN on a SUPER_ADMIN-required route', () => {
    const ctx = buildContext({ role: AdminRole.ADMIN }, [
      AdminRole.SUPER_ADMIN,
    ]);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows SUPER_ADMIN on a SUPER_ADMIN-required route', () => {
    const ctx = buildContext({ role: AdminRole.SUPER_ADMIN }, [
      AdminRole.SUPER_ADMIN,
    ]);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  // No user
  it('throws ForbiddenException when user has no role', () => {
    const ctx = buildContext({ id: '1' }, [AdminRole.MODERATOR]);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user is null', () => {
    const ctx = buildContext(null, [AdminRole.MODERATOR]);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  // Multi-role requirements (OR semantics)
  it('allows MODERATOR when route accepts [MODERATOR, ADMIN]', () => {
    const ctx = buildContext({ role: AdminRole.MODERATOR }, [
      AdminRole.MODERATOR,
      AdminRole.ADMIN,
    ]);
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
