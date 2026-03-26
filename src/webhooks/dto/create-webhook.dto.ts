import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsBoolean, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateWebhookDto {
  @ApiProperty()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  url!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  events!: string[];

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  secret!: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
