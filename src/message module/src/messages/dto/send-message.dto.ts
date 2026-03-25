import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ContentType } from '../message.entity';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsEnum(ContentType)
  contentType!: ContentType;

  @IsOptional()
  @IsString()
  replyToId?: string;
}
