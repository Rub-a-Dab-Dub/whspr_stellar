import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { AuditActionType } from '../constants/audit-actions';

export class AuditLogResponseDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  actorId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  targetId!: string | null;

  @ApiProperty()
  @Expose()
  action!: AuditActionType;

  @ApiProperty()
  @Expose()
  resource!: string;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  resourceId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  ipAddress!: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  userAgent!: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Expose()
  metadata!: Record<string, unknown> | null;

  @ApiProperty()
  @Expose()
  createdAt!: Date;
}

export class PaginatedAuditLogResponseDto {
  @ApiProperty({ type: [AuditLogResponseDto] })
  data!: AuditLogResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}
