import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UserRole } from '../../user/entities/user.entity';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * RolesGuard enforces role-based access control using metadata set by @Roles().
 *
 * Must be registered AFTER JwtAuthGuard in the guard chain so that request.user
 * is already populated from the verified JWT when this guard runs.
 *
 * Behaviour:
 *  - @Public() routes: skipped entirely (no auth, no role check)
 *  - No @Roles() on route: allow (any authenticated user passes)
 *  - @Roles(...roles): user must possess at least one listed role
 *
 * ADMIN implicitly passes ALL role checks — admins have full access.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Skip entirely for public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // 2. Read required roles from metadata (handler takes precedence over class)
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 3. No role restriction on this route — any authenticated user passes
    if (!requiredRoles || requiredRoles.length === 0) return true;

    // 4. Extract user from request (set by JwtAuthGuard / JwtStrategy)
    const request = context.switchToHttp().getRequest();
    const user: JwtPayload | undefined = request.user;

    if (!user) {
      throw new ForbiddenException('No authenticated user found on request.');
    }

    // 5. ADMIN implicitly satisfies every role requirement
    if (user.role === UserRole.ADMIN) return true;

    // 6. Check if user's role is in the required roles list
    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required role(s): ${requiredRoles.join(', ')}. ` +
          `Your role: ${user.role}.`,
      );
    }

    return true;
  }
}
