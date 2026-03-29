import { IsString, IsUrl, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetPreviewDto {
  @ApiProperty({ example: 'https://example.com' })
  @IsString()
  @IsUrl({}, { message: 'Must be valid URL' })
  url!: string;
}
