import { IsEnum, IsArray, IsString, IsOptional, ArrayNotEmpty, ValidateIf } from 'class-validator';
import { ConversationType } from '../entities/conversation.entity';

export class CreateConversationDto {
  @IsEnum(ConversationType)
  type: ConversationType;

  @ValidateIf((o) => o.type === ConversationType.GROUP)
  @IsString()
  groupId?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  participants: string[];
}
