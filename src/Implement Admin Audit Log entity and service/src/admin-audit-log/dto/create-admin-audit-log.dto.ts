import { AdminAuditLogAction, AuditLogTargetType } from '../enums';

export class CreateAdminAuditLogDto {
  adminId: string;
  adminEmail: string;
  action: AdminAuditLogAction;
  targetType: AuditLogTargetType;
  targetId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
}
