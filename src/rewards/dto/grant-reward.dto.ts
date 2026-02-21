import {
  IsEnum,
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsBoolean,
  IsObject,
} from 'class-validator';
import { RewardType } from '../enums/reward-type.enum';

export class GrantRewardDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  rewardId!: string;

  @IsOptional()
  @IsUUID()
  grantedByUserId?: string;

  @IsOptional()
  @IsString()
  eventName?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
