import { IsString, IsEnum, IsOptional, IsNumber, IsDateString, Length, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomType } from '../entities/room.entity';

export class CreateRoomDto {
  @ApiProperty({ example: 'General Chat', minLength: 3, maxLength: 50 })
  @IsString()
  @Length(3, 50)
  name: string;

  @ApiPropertyOptional({ example: 'A room for general discussion' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: RoomType, example: RoomType.PUBLIC })
  @IsEnum(RoomType)
  type: RoomType;

  @ApiPropertyOptional({ example: '0.01' })
  @IsOptional()
  @IsString()
  entryFee?: string;

  @ApiPropertyOptional({ example: '0x...' })
  @IsOptional()
  @IsString()
  tokenAddress?: string;

  @ApiPropertyOptional({ example: 100, minimum: 2, maximum: 1000 })
  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(1000)
  maxMembers?: number;

  @ApiPropertyOptional({ example: '2025-12-31T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
