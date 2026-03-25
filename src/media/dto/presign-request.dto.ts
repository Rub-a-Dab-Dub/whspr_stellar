import { IsEnum, IsString, IsNumber, Min, Max, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MediaType } from '../enums/media-type.enum';

export class PresignRequestDto {
  @ApiProperty({ enum: MediaType, description: 'Type of media being uploaded' })
  @IsEnum(MediaType)
  mediaType: MediaType;

  @ApiProperty({ description: 'MIME type of the file (e.g. image/jpeg)' })
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @ApiProperty({ description: 'File size in bytes' })
  @IsNumber()
  @Min(1)
  @Max(25 * 1024 * 1024) // global cap 25 MB
  fileSizeBytes: number;

  @ApiProperty({ description: 'Original filename', required: false })
  @IsString()
  @IsNotEmpty()
  fileName: string;
}
