import {
  IsString,
  IsArray,
  IsEnum,
  IsOptional,
  IsUrl,
  MaxLength,
  ArrayNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WebhookEvent } from '../../enums/webhook-event.enum';

export class CreateWebhookDto {
  @ApiProperty({ example: 'https://example.com/webhook' })
  @IsUrl({ require_tls: true, require_protocol: true, protocols: ['https'] }, {
    message: 'url must be a valid HTTPS URL',
  })
  url: string;

  @ApiProperty({
    enum: WebhookEvent,
    isArray: true,
    example: ['user.registered', 'transaction.confirmed'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(WebhookEvent, { each: true })
  events: string[];

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
