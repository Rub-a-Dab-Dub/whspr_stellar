import { IsEnum, IsString, IsOptional, IsNumber, IsBoolean, IsObject, Min } from 'class-validator';
import { RewardType } from '../enums/reward-type.enum';

export class CreateRewardDto {
  @IsEnum(RewardType)
  type!: RewardType;

  @IsNumber()
  @Min(0)
  value!: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  stackLimit?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  expirationDays?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isTradeable?: boolean;

  @IsBoolean()
  @IsOptional()
  isGiftable?: boolean;

  @IsBoolean()
  @IsOptional()
  isMarketplaceItem?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  marketplacePrice?: number;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
