import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AppPlatform } from '../entities/app-version.entity';

export class CreateAppVersionDto {
  @ApiProperty({ enum: AppPlatform, example: AppPlatform.IOS })
  @IsEnum(AppPlatform)
  platform!: AppPlatform;

  @ApiProperty({ example: '2.4.0' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  version!: string;

  @ApiProperty({ example: '2.3.0' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  minSupportedVersion!: string;

  @ApiPropertyOptional({ example: 'Bug fixes and a refreshed onboarding flow.' })
  @IsOptional()
  @IsString()
  releaseNotes?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isForceUpdate?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isSoftUpdate?: boolean;

  @ApiPropertyOptional({ example: '2026-03-28T10:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  publishedAt?: Date;
}
