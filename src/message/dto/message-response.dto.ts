import { MessageEditHistoryDto } from './message-edit-history.dto';

export class MessageResponseDto {
  id: string;
  conversationId: string;
  authorId: string;
  content: string;
  originalContent: string | null;
  isEdited: boolean;
  editedAt: Date | null;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  editHistory?: MessageEditHistoryDto[];
}
