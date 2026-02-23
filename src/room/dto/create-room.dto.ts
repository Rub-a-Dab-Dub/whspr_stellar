import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEnum,
  IsInt,
  IsArray,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsDateString,
  ArrayMaxSize,
} from 'class-validator';
import { RoomType } from '../entities/room.entity';
import { ROOM_MEMBER_CONSTANTS } from '../constants/room-member.constants';
import { RoomCategory } from '../enums/room-category.enum';

export class CreateRoomDto {
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsEnum(RoomType)
  @IsOptional()
  roomType?: RoomType;

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

  @IsInt()
  @Min(ROOM_MEMBER_CONSTANTS.MIN_MAX_MEMBERS)
  @Max(ROOM_MEMBER_CONSTANTS.MAX_MAX_MEMBERS)
  @IsOptional()
  maxMembers?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @Min(1)
  @Max(10080)
  @IsOptional()
  durationMinutes?: number;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @IsEnum(RoomCategory)
  @IsOptional()
  category?: RoomCategory;

  @IsArray()
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  @ArrayMaxSize(10)
  @IsOptional()
  tags?: string[];
}
