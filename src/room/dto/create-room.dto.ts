import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsBoolean()
  @IsOptional()
  isTokenGated?: boolean;

  @IsString()
  @IsOptional()
  entryFee?: string;

  @IsString()
  @IsOptional()
  tokenAddress?: string;

  @IsBoolean()
  @IsOptional()
  paymentRequired?: boolean;

  @IsBoolean()
  @IsOptional()
  freeTrialEnabled?: boolean;

  @IsNumber()
  @IsOptional()
  freeTrialDurationHours?: number;

  @IsNumber()
  @IsOptional()
  accessDurationDays?: number;
}
