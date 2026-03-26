import { IsString, IsOptional, IsEnum, IsUUID, IsNumber } from 'class-validator';

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  TRANSFER = 'transfer',
}

export class MessageNewDto {
  @IsUUID()
  conversationId: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @IsOptional()
  @IsUUID()
  replyToId?: string;
}

export class MessageEditDto {
  @IsUUID()
  messageId: string;

  @IsUUID()
  conversationId: string;

  @IsString()
  content: string;
}

export class MessageDeleteDto {
  @IsUUID()
  messageId: string;

  @IsUUID()
  conversationId: string;
}

export class ReactionNewDto {
  @IsUUID()
  messageId: string;

  @IsUUID()
  conversationId: string;

  @IsString()
  emoji: string;
}

export class TypingDto {
  @IsUUID()
  conversationId: string;
}

export class JoinRoomDto {
  @IsUUID()
  conversationId: string;

  @IsOptional()
  @IsNumber()
  lastEventTimestamp?: number;
}

export class LeaveRoomDto {
  @IsUUID()
  conversationId: string;
}
