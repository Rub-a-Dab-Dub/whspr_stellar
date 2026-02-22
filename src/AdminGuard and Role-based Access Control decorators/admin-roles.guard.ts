import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ADMIN_ROLES_KEY } from '../decorators/admin-roles.decorator';
import { AdminRole, hasRequiredRole } from '../enums/admin-role.enum';

/**
 * AdminRolesGuard enforces role-based access using metadata set by @AdminRoles().
 * Must be used AFTER AdminGuard so that req.user is already populated.
 *
 * Role hierarchy: SUPER_ADMIN > ADMIN > MODERATOR
 * A user with a higher role automatically satisfies lower-role requirements.
 *
 * If no roles metadata is set on the route, access is granted to any authenticated admin.
 */
@Injectable()
export class AdminRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[]>(
      ADMIN_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No roles restriction — any authenticated admin may proceed
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.role) {
      throw new ForbiddenException('Access denied: no role assigned to admin');
    }

    const adminRole: AdminRole = user.role;

    // The user satisfies the requirement if their role is >= ANY of the required roles
    const isAllowed = requiredRoles.some((requiredRole) =>
      hasRequiredRole(adminRole, requiredRole),
    );

    if (!isAllowed) {
      throw new ForbiddenException(
        `Access denied: requires one of [${requiredRoles.join(', ')}], but user has role [${adminRole}]`,
      );
    }

    return true;
  }
}
