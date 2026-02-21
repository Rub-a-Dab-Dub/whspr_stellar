import {
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  Min,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum UserFilterStatus {
  ALL = 'all',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BANNED = 'banned',
  SUSPENDED = 'suspended',
}

export class GetUsersDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(UserFilterStatus)
  status?: UserFilterStatus;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isBanned?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isSuspended?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isVerified?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';

  @IsOptional()
  @IsDateString()
  createdAfter?: string;

  @IsOptional()
  @IsDateString()
  createdBefore?: string;
}
