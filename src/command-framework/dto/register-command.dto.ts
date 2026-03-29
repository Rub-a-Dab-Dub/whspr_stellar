import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, IsBoolean } from 'class-validator';
import { CommandScope } from '../entities/bot-command.entity';

export class RegisterCommandDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  command!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  description!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  usage!: string;

  @ApiPropertyOptional({ enum: CommandScope, default: CommandScope.GLOBAL })
  @IsOptional()
  @IsEnum(CommandScope)
  scope?: CommandScope;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  botId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

