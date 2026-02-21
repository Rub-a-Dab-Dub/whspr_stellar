export enum AdminRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
}

/**
 * Role hierarchy: SUPER_ADMIN > ADMIN > MODERATOR
 * Higher index = higher privilege
 */
export const ROLE_HIERARCHY: AdminRole[] = [
  AdminRole.MODERATOR,
  AdminRole.ADMIN,
  AdminRole.SUPER_ADMIN,
];

export function getRoleLevel(role: AdminRole): number {
  return ROLE_HIERARCHY.indexOf(role);
}

export function hasRequiredRole(userRole: AdminRole, requiredRole: AdminRole): boolean {
  return getRoleLevel(userRole) >= getRoleLevel(requiredRole);
}
