import { ApiProperty } from '@nestjs/swagger';

export class PresignAttachmentResponseDto {
  @ApiProperty({ example: 'https://s3.amazonaws.com/...' })
  uploadUrl!: string;

  @ApiProperty({ example: 'uploads/user-id/message-id/1700000000-file.jpg' })
  fileKey!: string;

  @ApiProperty({ example: 'https://cdn.example.com/uploads/user-id/message-id/1700000000-file.jpg' })
  fileUrl!: string;

  @ApiProperty({ example: 300, description: 'URL expiry in seconds' })
  expiresIn!: number;

  @ApiProperty({ example: '2026-03-24T10:00:00.000Z' })
  expiresAt!: string;

  @ApiProperty({ example: 10485760, description: 'Max allowed size in bytes for current user tier' })
  maxAllowedFileSize!: number;
}
