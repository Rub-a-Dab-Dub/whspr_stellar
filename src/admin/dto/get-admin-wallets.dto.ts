import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class GetAdminWalletsDto {
  @IsOptional()
  @IsIn(['active', 'failed', 'pending'])
  status?: 'active' | 'failed' | 'pending';

  @IsOptional()
  @IsString()
  chain?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minBalance?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxBalance?: number;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsIn(['balance', 'createdAt', 'lastSyncedAt'])
  sortBy?: 'balance' | 'createdAt' | 'lastSyncedAt' = 'createdAt';

  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  sortOrder?: 'ASC' | 'DESC' | 'asc' | 'desc' = 'DESC';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
