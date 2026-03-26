import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AuditAction, AuditActionType } from '../constants/audit-actions';

export class AuditLogExportDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiPropertyOptional({ enum: AuditAction })
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditActionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}
