import { IsNumber, IsOptional, Min, Max, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartLocationShareDto {
  @ApiProperty({ example: 6.5244 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ example: 3.3792 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiPropertyOptional({ example: 10.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;

  @ApiPropertyOptional({ example: 30, description: 'Duration in minutes (max 480)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(480)
  duration?: number;
}

export class UpdateLocationDto {
  @ApiProperty({ example: 6.5244 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ example: 3.3792 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiPropertyOptional({ example: 10.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;
}

export class LocationShareResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  conversationId!: string;

  @ApiProperty()
  latitude!: number;

  @ApiProperty()
  longitude!: number;

  @ApiPropertyOptional()
  accuracy!: number | null;

  @ApiProperty()
  duration!: number;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  lastUpdatedAt!: Date;

  @ApiProperty()
  createdAt!: Date;
}
