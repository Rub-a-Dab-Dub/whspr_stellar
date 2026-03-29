import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, Matches, MinLength, MaxLength, IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export const EMOJI_NAME_REGEX = /^[a-z0-9_]+$/;
export const ALLOWED_MIME_TYPES = ['image/png', 'image/gif'];
export const MAX_FILE_SIZE_BYTES = 256 * 1024; // 256 KB
export const MAX_EMOJI_PER_GROUP = 50;
export const PRESIGN_EXPIRY_SECONDS = 300;

export class PresignEmojiUploadDto {
  @ApiProperty({ example: 'party_parrot', description: 'Alphanumeric + underscore, 2-32 chars' })
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  @Matches(EMOJI_NAME_REGEX, { message: 'name must be lowercase alphanumeric and underscores only' })
  name!: string;

  @ApiProperty({ example: 'image/png', enum: ['image/png', 'image/gif'] })
  @IsString()
  mimeType!: string;

  @ApiProperty({ example: 102400, description: 'File size in bytes (max 256 KB)' })
  @IsInt()
  @Min(1)
  @Max(MAX_FILE_SIZE_BYTES)
  fileSize!: number;
}

export class ConfirmEmojiUploadDto {
  @ApiProperty({ example: 'party_parrot' })
  @IsString()
  @MinLength(2)
  @MaxLength(32)
  @Matches(EMOJI_NAME_REGEX, { message: 'name must be lowercase alphanumeric and underscores only' })
  name!: string;

  @ApiProperty({ example: 'emoji/group-id/party_parrot.png' })
  @IsString()
  fileKey!: string;

  @ApiProperty({ example: 'https://cdn.example.com/emoji/group-id/party_parrot.png' })
  @IsString()
  imageUrl!: string;
}

export class EmojiSearchQueryDto {
  @ApiProperty({ example: 'party' })
  @IsString()
  @MinLength(1)
  q!: string;

  @ApiPropertyOptional({ example: 'group-uuid' })
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class CustomEmojiResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  groupId!: string;

  @ApiProperty()
  uploadedBy!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  imageUrl!: string;

  @ApiProperty()
  usageCount!: number;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;
}

export class PresignEmojiResponseDto {
  @ApiProperty()
  uploadUrl!: string;

  @ApiProperty()
  fileKey!: string;

  @ApiProperty()
  expiresIn!: number;
}
