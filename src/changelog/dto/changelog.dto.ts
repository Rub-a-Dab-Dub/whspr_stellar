import {
  IsString,
  IsEnum,
  IsArray,
  IsOptional,
  IsBoolean,
  MinLength,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { ChangelogPlatform, ChangelogType } from '../entities/changelog.entity';

export class CreateChangelogDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  version: string;

  @IsEnum(ChangelogPlatform)
  @IsOptional()
  platform?: ChangelogPlatform;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  @IsOptional()
  highlights?: string[];

  @IsString()
  @IsOptional()
  fullContent?: string;

  @IsEnum(ChangelogType)
  @IsOptional()
  type?: ChangelogType;
}

export class UpdateChangelogDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @IsOptional()
  title?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  @IsOptional()
  highlights?: string[];

  @IsString()
  @IsOptional()
  fullContent?: string;

  @IsEnum(ChangelogType)
  @IsOptional()
  type?: ChangelogType;

  @IsEnum(ChangelogPlatform)
  @IsOptional()
  platform?: ChangelogPlatform;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}

export class MarkSeenDto {
  @IsString()
  @MinLength(1)
  version: string;
}
