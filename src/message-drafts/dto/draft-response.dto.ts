export class DraftResponseDto {
  id!: string;
  userId!: string;
  conversationId!: string;
  content!: string;
  attachmentIds!: string[] | null;
  replyToId!: string | null;
  updatedAt!: Date;
}
