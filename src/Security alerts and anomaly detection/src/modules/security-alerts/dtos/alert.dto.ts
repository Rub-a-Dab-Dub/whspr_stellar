import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export enum AlertSeverityEnum {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum AlertStatusEnum {
  OPEN = 'open',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
}

export enum AlertRuleEnum {
  SPAM = 'spam',
  WASH_TRADING = 'wash_trading',
  EARLY_WITHDRAWAL = 'early_withdrawal',
  IP_REGISTRATION_FRAUD = 'ip_registration_fraud',
  ADMIN_NEW_IP = 'admin_new_ip',
}

export class UpdateAlertDto {
  @IsOptional()
  @IsEnum(AlertStatusEnum)
  status?: AlertStatusEnum;

  @IsOptional()
  @IsString()
  note?: string;
}

export class AlertQueryDto {
  @IsOptional()
  @IsEnum(AlertSeverityEnum)
  severity?: AlertSeverityEnum;

  @IsOptional()
  @IsEnum(AlertStatusEnum)
  status?: AlertStatusEnum;

  @IsOptional()
  @IsNumber()
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  limit?: number = 20;
}

export class CreateAlertDto {
  @IsString()
  rule: string;

  @IsEnum(AlertSeverityEnum)
  severity: AlertSeverityEnum;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  adminId?: string;

  @IsOptional()
  details?: Record<string, any>;
}
