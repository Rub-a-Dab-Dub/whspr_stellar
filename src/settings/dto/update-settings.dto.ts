import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsBoolean,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { VisibilityType } from '../entities/user-settings.entity';

export class UpdateSettingsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  notificationPreferences?: any;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  privacySettings?: any;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  theme?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class Confirm2FADto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token!: string;
}
