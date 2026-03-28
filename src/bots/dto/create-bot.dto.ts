import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateBotCommandDto } from './create-bot-command.dto';

export class CreateBotDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  username!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  avatarUrl?: string;

  @ApiProperty()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  webhookUrl!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  webhookSecret!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  scopes!: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [CreateBotCommandDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBotCommandDto)
  commands?: CreateBotCommandDto[];
}
