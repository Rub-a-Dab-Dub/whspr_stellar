export const AuditAction = {
  AUTH_LOGIN: 'AUTH_LOGIN',
  AUTH_LOGOUT: 'AUTH_LOGOUT',
  TRANSFER_INITIATED: 'TRANSFER_INITIATED',
  GROUP_MEMBER_REMOVED: 'GROUP_MEMBER_REMOVED',
  ROLE_CHANGED: 'ROLE_CHANGED',
  KEY_ROTATED: 'KEY_ROTATED',
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];
