import { IsString, IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class QueuePreviewsDto {
  @ApiProperty({ example: 'msg-uuid' })
  @IsUUID()
  messageId: string;

  @ApiProperty({ example: ['https://ex.com'] })
  @IsArray()
  @IsString({ each: true })
  urls: string[];
}
