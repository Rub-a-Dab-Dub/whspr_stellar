import { IsUUID, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MentionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  messageId!: string;

  @ApiProperty({ format: 'uuid' })
  mentionedUserId!: string;

  @ApiProperty({ format: 'uuid' })
  mentionedBy!: string;

  @ApiProperty({ format: 'uuid' })
  conversationId!: string;

  @ApiProperty()
  isRead!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class MentionListResponseDto {
  @ApiProperty({ type: [MentionResponseDto] })
  data!: MentionResponseDto[];

  @ApiProperty()
  total!: number;
}

export class UnreadCountResponseDto {
  @ApiProperty({ description: 'Number of unread mentions' })
  unreadCount!: number;
}

export class MarkMentionReadDto {
  @ApiPropertyOptional({ description: 'Mark as read (default: true)' })
  @IsOptional()
  @IsBoolean()
  isRead?: boolean = true;
}

export class MarkAllMentionsReadDto {
  @ApiPropertyOptional({ description: 'Mark all as read (default: true)' })
  @IsOptional()
  @IsBoolean()
  isRead?: boolean = true;
}

export class ParsedMention {
  username: string;
  userId: string;
  position: number;
  length: number;
}
