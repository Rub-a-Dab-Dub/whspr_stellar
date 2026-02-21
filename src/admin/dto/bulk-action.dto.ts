import { IsArray, IsString, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum BulkActionType {
  BAN = 'ban',
  UNBAN = 'unban',
  SUSPEND = 'suspend',
  UNSUSPEND = 'unsuspend',
  VERIFY = 'verify',
  UNVERIFY = 'unverify',
  DELETE = 'delete',
}

export class BulkActionDto {
  @ApiProperty({ type: [String], example: ['uuid-1', 'uuid-2'] })
  @IsArray()
  @IsString({ each: true })
  userIds: string[];

  @ApiProperty({ enum: BulkActionType })
  @IsEnum(BulkActionType)
  action: BulkActionType;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ example: '2025-03-01T00:00:00Z', description: 'Required for SUSPEND action' })
  @IsString()
  @IsOptional()
  suspendedUntil?: string;
}
