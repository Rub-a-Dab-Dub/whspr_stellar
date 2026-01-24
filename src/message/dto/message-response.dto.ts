import { MessageType } from '../enums/message-type.enum';
import { MessageEditHistoryDto } from './message-edit-history.dto';

export class MessageResponseDto {
  id: string;
  conversationId: string;
  roomId: string;
  authorId: string;
  author?: {
    id: string;
    email: string;
  };
  content: string;
  type: MessageType;
  mediaUrl?: string | null;
  fileName?: string | null;
  originalContent: string | null;
  isEdited: boolean;
  editedAt: Date | null;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  editHistory?: MessageEditHistoryDto[];
  reactionsCount?: number;
}
