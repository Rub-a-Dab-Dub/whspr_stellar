import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

function parseTagsInput(value: unknown): string[] | undefined {
  if (value == null || value === '') {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map(String);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map(String);
      }
    } catch {
      /* comma-separated */
    }
    return value
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return undefined;
}

export class CreateUserStickerPackDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: '0 = free', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;
}

export class AddUserStickerDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ type: [String], description: 'Array, JSON string, or comma-separated' })
  @IsOptional()
  @Transform(({ value }) => parseTagsInput(value))
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === undefined || value === null) {
      return undefined;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    description: 'S3 key after client presigned upload (alternative to multipart file)',
  })
  @IsOptional()
  @IsString()
  fileKey?: string;
}

export class UserStickerResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  packId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  fileUrl!: string;

  @ApiProperty({ type: [String] })
  tags!: string[];

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty()
  createdAt!: string;
}

export class UserStickerPackResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  creatorId!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiPropertyOptional()
  coverUrl!: string | null;

  @ApiProperty()
  isPublished!: boolean;

  @ApiProperty()
  isApproved!: boolean;

  @ApiProperty()
  downloadCount!: number;

  @ApiProperty()
  price!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiPropertyOptional({ type: [UserStickerResponseDto] })
  stickers?: UserStickerResponseDto[];

  @ApiPropertyOptional()
  stickerCount?: number;
}

export class BrowseUserStickerPacksQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}

export class DownloadPackResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty()
  stickersUnlocked!: number;

  @ApiProperty()
  message!: string;
}

export class ApproveRejectPackDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
