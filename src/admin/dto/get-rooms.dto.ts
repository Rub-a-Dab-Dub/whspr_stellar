import {
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  Min,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RoomType } from '../../room/entities/room.entity';

export enum RoomFilterStatus {
  ACTIVE = 'active',
  CLOSED = 'closed',
  FLAGGED = 'flagged',
  DELETED = 'deleted',
}

export class GetRoomsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(RoomType)
  type?: RoomType;

  @IsOptional()
  @IsEnum(RoomFilterStatus)
  status?: RoomFilterStatus;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  minMembers?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  maxMembers?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
