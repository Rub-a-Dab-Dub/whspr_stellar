import { ApiProperty } from '@nestjs/swagger';
import { MediaType } from '../enums/media-type.enum';

export class PresignResponseDto {
  @ApiProperty({ description: 'Unique object key for this upload' })
  key: string;

  @ApiProperty({ description: 'Pre-signed URL to PUT the file directly to S3/R2' })
  uploadUrl: string;

  @ApiProperty({ description: 'CDN URL where the asset will be accessible after confirmation' })
  cdnUrl: string;

  @ApiProperty({ enum: MediaType })
  mediaType: MediaType;

  @ApiProperty({ description: 'ISO timestamp when the pre-signed URL expires' })
  expiresAt: string;

  @ApiProperty({ description: 'Required Content-Type header for the PUT request' })
  contentType: string;
}
