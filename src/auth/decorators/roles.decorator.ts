import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../user/entities/user.entity';

export const ROLES_KEY = 'roles';

/**
 * Restrict a route or controller to one or more roles.
 * Must be used alongside RolesGuard (registered after JwtAuthGuard).
 *
 * @example
 * // Single role
 * @Roles(UserRole.ADMIN)
 * @Delete('users/:id')
 * deleteUser() { ... }
 *
 * @example
 * // Multiple roles — any match grants access
 * @Roles(UserRole.ADMIN, UserRole.MODERATOR)
 * @Patch('rooms/:id/ban')
 * banUser() { ... }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
