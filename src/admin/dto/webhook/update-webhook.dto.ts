import {
  IsString,
  IsArray,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsUrl,
  MaxLength,
  ArrayNotEmpty,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { WebhookEvent } from '../../enums/webhook-event.enum';

export class UpdateWebhookDto {
  @ApiPropertyOptional({ example: 'https://example.com/webhook' })
  @IsOptional()
  @IsUrl({ require_tls: true, require_protocol: true, protocols: ['https'] }, {
    message: 'url must be a valid HTTPS URL',
  })
  url?: string;

  @ApiPropertyOptional({
    enum: WebhookEvent,
    isArray: true,
    example: ['user.registered'],
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(WebhookEvent, { each: true })
  events?: string[];

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
