import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class AttachmentResponseDto {
  @Expose()
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @Expose()
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174111' })
  messageId!: string;

  @Expose()
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174222' })
  uploaderId!: string;

  @Expose()
  @ApiProperty({ example: 'https://cdn.example.com/uploads/file.jpg' })
  fileUrl!: string;

  @Expose()
  @ApiProperty({ example: 'uploads/user-id/message-id/file.jpg' })
  fileKey!: string;

  @Expose()
  @ApiProperty({ example: 'file.jpg' })
  fileName!: string;

  @Expose()
  @ApiProperty({ example: 12345 })
  fileSize!: number;

  @Expose()
  @ApiProperty({ example: 'image/jpeg' })
  mimeType!: string;

  @Expose()
  @ApiPropertyOptional({ example: 1920 })
  width!: number | null;

  @Expose()
  @ApiPropertyOptional({ example: 1080 })
  height!: number | null;

  @Expose()
  @ApiPropertyOptional({ example: 60 })
  duration!: number | null;

  @Expose()
  @ApiProperty({ example: '2026-03-24T10:00:00.000Z' })
  createdAt!: Date;
}
