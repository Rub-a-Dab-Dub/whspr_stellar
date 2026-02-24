import { AdminAuditLogAction, AuditLogTargetType } from '../enums';

export class AdminAuditLogFilterDto {
  adminId?: string;
  action?: AdminAuditLogAction;
  targetType?: AuditLogTargetType;
  targetId?: string;
  ipAddress?: string;
  startDate?: Date;
  endDate?: Date;
  page: number = 1;
  limit: number = 20;
}
