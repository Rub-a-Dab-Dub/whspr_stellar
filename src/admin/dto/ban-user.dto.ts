import {
  IsString,
  IsOptional,
  MaxLength,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export enum BanType {
  PERMANENT = 'permanent',
  TEMPORARY = 'temporary',
}

export class BanUserDto {
  @ApiProperty({ maxLength: 500, description: 'Reason for banning the user' })
  @IsString()
  @MaxLength(500)
  reason: string;

  @ApiProperty({
    enum: BanType,
    description: 'Type of ban: permanent or temporary',
  })
  @IsEnum(BanType)
  type: BanType;

  @ApiPropertyOptional({
    description: 'Expiration date for temporary bans (ISO date string)',
  })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
