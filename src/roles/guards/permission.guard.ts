// src/roles/guards/permission.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions) {
      return true; // No permissions required
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

    // Get all permissions from user's roles
    const userPermissions = roles.flatMap((role) =>
      role.permissions?.map((p) => p.name) || []
    );

    // Check if user has all required permissions
    return requiredPermissions.every((permission) =>
      userPermissions.includes(permission)
    );
  }
}