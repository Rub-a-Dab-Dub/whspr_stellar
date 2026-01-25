// src/roles/guards/role.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RoleType } from '../entities/role.entity';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleType[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true; // No roles required
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Get user object (could be user.user from JWT strategy or direct user)
    const userObj = user.user || user;
    const roles = userObj?.roles || [];

    if (!roles || roles.length === 0) {
      return false;
    }

    // Check if user has any of the required roles
    return requiredRoles.some((role) =>
      roles.some((userRole) => userRole.name === role),
    );
  }
}
