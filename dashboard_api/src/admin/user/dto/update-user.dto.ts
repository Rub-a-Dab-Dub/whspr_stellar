import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEmail, IsNumber, IsBoolean, IsArray } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'john_doe_updated' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ example: 'newemail@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'Updated bio' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  level?: number;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @IsNumber()
  xp?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isSuspended?: boolean;

  @ApiPropertyOptional({ example: 'Policy violation' })
  @IsOptional()
  @IsString()
  suspensionReason?: string;

  @ApiPropertyOptional({ example: ['verified', 'premium'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  badges?: string[];
}
