import { SetMetadata } from '@nestjs/common';
import { AuditActionType } from '../constants/audit-actions';

export const AUDIT_ACTION_KEY = 'audit_action';
export const AUDIT_RESOURCE_KEY = 'audit_resource';

export interface AuditActionMeta {
  action: AuditActionType;
  resource: string;
}

/**
 * Attach to a controller method to have the AuditLogInterceptor
 * automatically record the action after a successful response.
 *
 * @example
 * @AuditAction(AuditAction.AUTH_LOGIN, 'auth')
 */
export const AuditActionDecorator = (action: AuditActionType, resource: string): MethodDecorator =>
  SetMetadata<string, AuditActionMeta>(AUDIT_ACTION_KEY, { action, resource });
