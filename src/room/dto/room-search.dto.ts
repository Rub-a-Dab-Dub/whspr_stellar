import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  IsArray,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RoomType } from '../entities/room.entity';
import { RoomCategory } from '../enums/room-category.enum';

export enum RoomSortBy {
  NEWEST = 'newest',
  POPULAR = 'popular',
  ACTIVE = 'active',
}

export class RoomSearchDto {
  @ApiPropertyOptional({ description: 'Full-text search across room name and description' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: RoomType })
  @IsOptional()
  @IsEnum(RoomType)
  roomType?: RoomType;

  @ApiPropertyOptional({ enum: RoomCategory })
  @IsOptional()
  @IsEnum(RoomCategory)
  category?: RoomCategory;

  @ApiPropertyOptional({
    description: 'Comma-separated list of tags to filter by',
    example: 'defi,nft',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',').map((t: string) => t.trim()).filter(Boolean) : value,
  )
  tags?: string[];

  @ApiPropertyOptional({ minimum: 0, description: 'Minimum member count' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minMembers?: number;

  @ApiPropertyOptional({ minimum: 0, description: 'Maximum member count' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxMembers?: number;

  @ApiPropertyOptional({ description: 'Filter rooms that require an entry fee' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  hasEntryFee?: boolean;

  @ApiPropertyOptional({ enum: RoomSortBy, default: RoomSortBy.NEWEST })
  @IsOptional()
  @IsEnum(RoomSortBy)
  sortBy?: RoomSortBy = RoomSortBy.NEWEST;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class TrendingRoomsDto {
  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
