import { ConversationType } from '../entities/conversation.entity';

export class ParticipantResponseDto {
  userId: string;
  joinedAt: Date;
  lastReadAt?: Date;
  isMuted: boolean;
}

export class ConversationResponseDto {
  id: string;
  type: ConversationType;
  groupId?: string;
  createdBy: string;
  lastMessageAt?: Date;
  isArchived: boolean;
  createdAt: Date;
  participants: ParticipantResponseDto[];
  unreadCount?: number;
}
