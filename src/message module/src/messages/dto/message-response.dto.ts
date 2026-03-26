import { Message } from '../message.entity';

export class MessageResponseDto {
  id!: string;
  conversationId!: string;
  senderId!: string;
  content!: string | null;
  contentType!: string;
  replyToId?: string | null;
  isEdited!: boolean;
  isDeleted!: boolean;
  sentAt!: string;
  deliveredAt?: string | null;
  readAt?: string | null;
  editedAt?: string | null;

  static fromEntity(entity: Message): MessageResponseDto {
    const dto = new MessageResponseDto();
    dto.id = entity.id;
    dto.conversationId = entity.conversationId;
    dto.senderId = entity.senderId;
    dto.content = entity.content;
    dto.contentType = entity.contentType;
    dto.replyToId = entity.replyToId ?? null;
    dto.isEdited = entity.isEdited;
    dto.isDeleted = entity.isDeleted;
    dto.sentAt = entity.sentAt.toISOString();
    dto.deliveredAt = entity.deliveredAt ? entity.deliveredAt.toISOString() : null;
    dto.readAt = entity.readAt ? entity.readAt.toISOString() : null;
    dto.editedAt = entity.editedAt ? entity.editedAt.toISOString() : null;
    return dto;
  }
}
