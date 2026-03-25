import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ContentType, Message } from './message.entity';
import { decodeCursor, encodeCursor, PaginatedResult, PaginationQuery } from './pagination';

interface CreateMessageInput {
  conversationId: string;
  senderId: string;
  content: string | null;
  contentType: ContentType;
  replyToId?: string | null;
  sentAt: Date;
}

@Injectable()
export class MessagesRepository {
  private readonly messages: Message[] = [];

  async create(input: CreateMessageInput): Promise<Message> {
    const message: Message = {
      id: randomUUID(),
      conversationId: input.conversationId,
      senderId: input.senderId,
      content: input.content,
      contentType: input.contentType,
      replyToId: input.replyToId ?? null,
      sentAt: input.sentAt,
      isDeleted: false,
      isEdited: false,
      deliveredAt: null,
      readAt: null,
      editedAt: null,
    };
    this.messages.push(message);
    return message;
  }

  async findById(id: string): Promise<Message | undefined> {
    return this.messages.find((m) => m.id === id);
  }

  async findByConversation(conversationId: string, query: PaginationQuery): Promise<PaginatedResult<Message>> {
    const limit = Math.max(1, Math.min(100, query.limit));
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;

    const sorted = this.messages
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => {
        if (a.sentAt.getTime() === b.sentAt.getTime()) {
          return a.id.localeCompare(b.id);
        }
        return a.sentAt.getTime() - b.sentAt.getTime();
      });

    let startIndex = 0;
    if (cursor) {
      startIndex = sorted.findIndex(
        (m) => m.sentAt.getTime() === cursor.sentAt.getTime() && m.id === cursor.id,
      );
      if (startIndex >= 0) startIndex += 1;
      else startIndex = 0;
    }

    const page = sorted.slice(startIndex, startIndex + limit);
    const last = page[page.length - 1];
    const hasMore = startIndex + limit < sorted.length;

    return {
      data: page,
      nextCursor: hasMore && last ? encodeCursor(last.sentAt, last.id) : null,
    };
  }

  async save(message: Message): Promise<Message> {
    const index = this.messages.findIndex((m) => m.id === message.id);
    if (index >= 0) {
      this.messages[index] = message;
    } else {
      this.messages.push(message);
    }
    return message;
  }
}
