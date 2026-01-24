import { Injectable } from '@nestjs/common';
import { MessagesGateway } from '../gateways/messages.gateway';
import { MessageResponseDto } from '../dto/message-response.dto';

@Injectable()
export class MessageBroadcastService {
  constructor(private readonly messagesGateway: MessagesGateway) {}

  /**
   * Broadcast message creation to room
   */
  broadcastMessageCreated(roomId: string, message: MessageResponseDto): void {
    this.messagesGateway.broadcastToRoom(roomId, 'message-created', message);
  }

  /**
   * Broadcast message edit to room
   */
  broadcastMessageUpdated(roomId: string, message: MessageResponseDto): void {
    this.messagesGateway.broadcastToRoom(roomId, 'message-updated', message);
  }

  /**
   * Broadcast message deletion to room
   */
  broadcastMessageDeleted(
    roomId: string,
    messageId: string,
    deletedAt: Date,
  ): void {
    this.messagesGateway.broadcastToRoom(roomId, 'message-deleted', {
      messageId,
      deletedAt,
    });
  }

  /**
   * Broadcast message restoration to room
   */
  broadcastMessageRestored(roomId: string, message: MessageResponseDto): void {
    this.messagesGateway.broadcastToRoom(roomId, 'message-restored', message);
  }

  /**
   * Broadcast reaction to message
   */
  broadcastReactionAdded(
    roomId: string,
    messageId: string,
    userId: string,
    reaction: string,
  ): void {
    this.messagesGateway.broadcastToRoom(roomId, 'reaction-added', {
      messageId,
      userId,
      reaction,
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast reaction removal
   */
  broadcastReactionRemoved(
    roomId: string,
    messageId: string,
    userId: string,
    reaction: string,
  ): void {
    this.messagesGateway.broadcastToRoom(roomId, 'reaction-removed', {
      messageId,
      userId,
      reaction,
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast user typing status
   */
  broadcastUserTyping(roomId: string, userId: string, isTyping: boolean): void {
    this.messagesGateway.broadcastToRoom(roomId, 'user-typing', {
      userId,
      isTyping,
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast user joined room
   */
  broadcastUserJoined(roomId: string, userId: string): void {
    this.messagesGateway.broadcastToRoom(roomId, 'user-joined', {
      userId,
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast user left room
   */
  broadcastUserLeft(roomId: string, userId: string): void {
    this.messagesGateway.broadcastToRoom(roomId, 'user-left', {
      userId,
      timestamp: new Date(),
    });
  }

  /**
   * Notify specific user
   */
  notifyUser(userId: string, event: string, data: any): void {
    this.messagesGateway.broadcastToUser(userId, event, data);
  }
}
