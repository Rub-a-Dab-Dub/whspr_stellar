import { IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRewardStatus } from '../enums/user-reward-status.enum';

export class InventoryQueryDto {
  @IsOptional()
  @IsEnum(UserRewardStatus)
  status?: UserRewardStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Boolean)
  includeExpired?: boolean = false;
}
