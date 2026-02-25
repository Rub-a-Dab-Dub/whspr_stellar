import { IsString, IsEnum, IsOptional, IsNumber, IsDateString, Length, Min, Max } from 'class-validator';
import { RoomType } from '../entities/room.entity';

export class CreateRoomDto {
  @IsString()
  @Length(3, 50)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(RoomType)
  type: RoomType;

  @IsOptional()
  @IsString()
  entryFee?: string;

  @IsOptional()
  @IsString()
  tokenAddress?: string;

  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(1000)
  maxMembers?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}