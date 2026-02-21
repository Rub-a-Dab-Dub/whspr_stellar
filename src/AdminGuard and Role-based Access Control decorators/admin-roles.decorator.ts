import { SetMetadata } from '@nestjs/common';
import { AdminRole } from '../enums/admin-role.enum';

export const ADMIN_ROLES_KEY = 'admin_roles';

/**
 * Decorator to set required admin roles on a route.
 * Usage: @AdminRoles(AdminRole.MODERATOR, AdminRole.ADMIN)
 */
export const AdminRoles = (...roles: AdminRole[]) =>
  SetMetadata(ADMIN_ROLES_KEY, roles);
