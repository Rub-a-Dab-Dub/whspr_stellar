import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsEnum,
  IsOptional,
  IsUrl,
  IsUUID,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MessageType } from '../enums/message-type.enum';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1, { message: 'Message content cannot be empty' })
  @MaxLength(5000, { message: 'Message content cannot exceed 5000 characters' })
  content: string;

  @IsEnum(MessageType)
  @IsOptional()
  type?: MessageType;

  @IsUrl()
  @IsOptional()
  mediaUrl?: string;

  @IsString()
  @IsOptional()
  fileName?: string;

  @IsUUID()
  @IsOptional()
  tipRecipientId?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  tipAmount?: number;
}
