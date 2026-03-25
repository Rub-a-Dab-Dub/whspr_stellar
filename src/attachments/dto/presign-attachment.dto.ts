import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class PresignAttachmentDto {
  @ApiProperty({
    description: 'Message id that this attachment belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  messageId!: string;

  @ApiProperty({
    description: 'Original file name',
    example: 'holiday-photo.jpg',
  })
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 1250000,
  })
  @IsInt()
  @Min(1)
  fileSize!: number;

  @ApiProperty({
    description: 'MIME type of the file',
    example: 'image/jpeg',
  })
  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @ApiPropertyOptional({
    description: 'Image/video width in pixels',
    example: 1920,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20000)
  width?: number;

  @ApiPropertyOptional({
    description: 'Image/video height in pixels',
    example: 1080,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20000)
  height?: number;

  @ApiPropertyOptional({
    description: 'Media duration in seconds',
    example: 42,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(86400)
  duration?: number;
}
