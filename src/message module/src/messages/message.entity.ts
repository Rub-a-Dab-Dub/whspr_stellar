export enum ContentType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  FILE = 'FILE',
  TRANSFER = 'TRANSFER',
}

export class Message {
  id!: string;
  conversationId!: string;
  senderId!: string;
  content!: string | null;
  contentType!: ContentType;
  replyToId?: string | null;
  isEdited = false;
  isDeleted = false;
  sentAt!: Date;
  deliveredAt?: Date | null;
  readAt?: Date | null;
  editedAt?: Date | null;
}
