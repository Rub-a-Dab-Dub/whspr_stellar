import { ApiProperty } from '@nestjs/swagger';
import { MediaType } from '../enums/media-type.enum';

export class ConfirmUploadResponseDto {
  @ApiProperty({ description: 'Object key of the confirmed upload' })
  key: string;

  @ApiProperty({ description: 'CDN URL of the original uploaded asset' })
  cdnUrl: string;

  @ApiProperty({ enum: MediaType })
  mediaType: MediaType;

  @ApiProperty({
    description: 'CDN URLs of all processed variants (resized copies)',
    type: [String],
  })
  variantUrls: string[];

  @ApiProperty({ description: 'Whether async processing has been queued' })
  processingQueued: boolean;
}
