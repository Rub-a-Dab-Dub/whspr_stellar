import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, IsUUID, Max, Min } from 'class-validator';

export const ALLOWED_VOICE_MIME_TYPES = ['audio/ogg', 'audio/mp4', 'audio/webm'] as const;
export type VoiceMimeType = (typeof ALLOWED_VOICE_MIME_TYPES)[number];

/** Max duration in seconds for standard (SILVER) tier users. */
export const MAX_DURATION_STANDARD = 300; // 5 min
/** Max duration in seconds for elevated (GOLD/BLACK) tier users. */
export const MAX_DURATION_ELEVATED = 600; // 10 min
/** Pre-signed URL TTL in seconds. */
export const PRESIGN_EXPIRY_SECONDS = 300; // 5 min

export class PresignVoiceMessageDto {
  @ApiProperty({ example: 'uuid-of-message' })
  @IsUUID()
  messageId!: string;

  @ApiProperty({ enum: ALLOWED_VOICE_MIME_TYPES })
  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @ApiProperty({ example: 512000 })
  @IsInt()
  @Min(1)
  fileSize!: number;

  /** Client-reported duration in seconds (used for pre-validation only). */
  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(1)
  @Max(MAX_DURATION_ELEVATED)
  duration!: number;
}

export class ConfirmVoiceMessageDto {
  @ApiProperty({ example: 'uploads/user-id/msg-id/file.ogg' })
  @IsString()
  @IsNotEmpty()
  fileKey!: string;

  @ApiProperty({ example: 512000 })
  @IsInt()
  @Min(1)
  fileSize!: number;

  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(1)
  duration!: number;
}

export class VoiceMessageResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() messageId!: string;
  @ApiProperty() uploaderId!: string;
  @ApiProperty() fileKey!: string;
  @ApiProperty() fileUrl!: string;
  @ApiPropertyOptional() duration!: number | null;
  @ApiPropertyOptional({ type: [Number] }) waveformData!: number[] | null;
  @ApiProperty() mimeType!: string;
  @ApiProperty() fileSize!: number;
  @ApiProperty() confirmed!: boolean;
  @ApiProperty() createdAt!: Date;
}

export class PresignVoiceMessageResponseDto {
  @ApiProperty() uploadUrl!: string;
  @ApiProperty() fileKey!: string;
  @ApiProperty() fileUrl!: string;
  @ApiProperty() expiresIn!: number;
  @ApiProperty() expiresAt!: string;
}
