export class MessageEditHistoryDto {
  id: string;
  messageId: string;
  previousContent: string;
  newContent: string;
  editedAt: Date;
}
