import {
  IsArray,
  IsString,
  IsEnum,
  IsOptional,
  MaxLength,
} from 'class-validator';

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
  @IsArray()
  @IsString({ each: true })
  userIds: string[];

  @IsEnum(BulkActionType)
  action: BulkActionType;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;

  @IsString()
  @IsOptional()
  suspendedUntil?: string;
}
