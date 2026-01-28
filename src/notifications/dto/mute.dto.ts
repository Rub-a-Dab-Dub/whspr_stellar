import { IsEnum, IsUUID, IsOptional, IsString, IsDateString } from 'class-validator';
import { MuteType } from '../enums/mute-type.enum';

export class CreateMuteDto {
  @IsEnum(MuteType)
  targetType!: MuteType;

  @IsUUID()
  targetId!: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateMuteDto {
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}