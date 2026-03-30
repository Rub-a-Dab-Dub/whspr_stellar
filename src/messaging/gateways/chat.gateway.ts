import { randomUUID } from 'crypto';
import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PresenceService } from '../services/presence.service';
import { TypingService } from '../services/typing.service';
import { EventReplayService } from '../services/event-replay.service';
import {
  JoinRoomDto,
  LeaveRoomDto,
  MessageDeleteDto,
  MessageEditDto,
  MessageNewDto,
  MessageType,
  ReactionNewDto,
  TypingDto,
} from '../dto/message-events.dto';

@WebSocketGateway({ namespace: '/chat', cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly presenceService: PresenceService,
    private readonly typingService: TypingService,
    private readonly eventReplayService: EventReplayService,
  ) {}

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) throw new Error('No token');

      const payload = this.jwtService.verify<{ sub: string; walletAddress: string }>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      client.data.user = payload;

      await this.presenceService.setOnline(payload.sub, client.id);

      this.server.emit('user:online', { userId: payload.sub, timestamp: Date.now() });

      this.logger.log(`[/chat] connected   socket=${client.id} user=${payload.sub}`);
    } catch {
      this.logger.warn(`[/chat] rejected unauthorized socket ${client.id}`);
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const user = client.data?.user as { sub: string } | undefined;
    if (!user) return;

    this.typingService.clearAllForUser(user.sub);
    await this.presenceService.setOffline(user.sub);

    this.server.emit('user:offline', { userId: user.sub, timestamp: Date.now() });

    this.logger.log(`[/chat] disconnected socket=${client.id} user=${user.sub}`);
  }

  // ─── Room management ────────────────────────────────────────────────────────

  @SubscribeMessage('room:join')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: JoinRoomDto,
  ): Promise<void> {
    const roomId = `conversation:${dto.conversationId}`;
    await client.join(roomId);

    if (dto.lastEventTimestamp !== undefined) {
      const missed = await this.eventReplayService.getMissedEvents(
        roomId,
        dto.lastEventTimestamp,
      );
      for (const e of missed) {
        client.emit(e.event, e.data);
      }
      this.logger.log(
        `[/chat] replayed ${missed.length} missed events → room=${roomId} user=${client.data.user.sub}`,
      );
    }

    this.logger.log(`[/chat] joined room=${roomId} user=${client.data.user.sub}`);
  }

  @SubscribeMessage('room:leave')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: LeaveRoomDto,
  ): Promise<void> {
    const roomId = `conversation:${dto.conversationId}`;
    await client.leave(roomId);
    this.logger.log(`[/chat] left   room=${roomId} user=${client.data.user.sub}`);
  }

  // ─── Messaging events ───────────────────────────────────────────────────────

  @SubscribeMessage('message:new')
  async handleMessageNew(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: MessageNewDto,
  ): Promise<void> {
    const roomId = `conversation:${dto.conversationId}`;
    const event = {
      id: randomUUID(),
      conversationId: dto.conversationId,
      senderId: (client.data.user as { sub: string }).sub,
      content: dto.content,
      type: dto.type ?? MessageType.TEXT,
      replyToId: dto.replyToId ?? null,
      timestamp: Date.now(),
    };

    await this.eventReplayService.storeEvent(roomId, 'message:new', event);
    this.server.to(roomId).emit('message:new', event);
  }

  @SubscribeMessage('message:edit')
  async handleMessageEdit(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: MessageEditDto,
  ): Promise<void> {
    const roomId = `conversation:${dto.conversationId}`;
    const event = {
      messageId: dto.messageId,
      conversationId: dto.conversationId,
      editorId: (client.data.user as { sub: string }).sub,
      content: dto.content,
      editedAt: Date.now(),
    };

    await this.eventReplayService.storeEvent(roomId, 'message:edit', event);
    this.server.to(roomId).emit('message:edit', event);
  }

  @SubscribeMessage('message:delete')
  async handleMessageDelete(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: MessageDeleteDto,
  ): Promise<void> {
    const roomId = `conversation:${dto.conversationId}`;
    const event = {
      messageId: dto.messageId,
      conversationId: dto.conversationId,
      deletedBy: (client.data.user as { sub: string }).sub,
      deletedAt: Date.now(),
    };

    await this.eventReplayService.storeEvent(roomId, 'message:delete', event);
    this.server.to(roomId).emit('message:delete', event);
  }

  @SubscribeMessage('reaction:new')
  async handleReactionNew(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: ReactionNewDto,
  ): Promise<void> {
    const roomId = `conversation:${dto.conversationId}`;
    const event = {
      messageId: dto.messageId,
      conversationId: dto.conversationId,
      userId: (client.data.user as { sub: string }).sub,
      emoji: dto.emoji,
      timestamp: Date.now(),
    };

    await this.eventReplayService.storeEvent(roomId, 'reaction:new', event);
    this.server.to(roomId).emit('reaction:new', event);
  }

  // ─── Typing indicators ──────────────────────────────────────────────────────

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: TypingDto,
  ): void {
    const roomId = `conversation:${dto.conversationId}`;
    const userId = (client.data.user as { sub: string }).sub;

    client.to(roomId).emit('typing:start', {
      userId,
      conversationId: dto.conversationId,
      timestamp: Date.now(),
    });

    // Auto-stop after 3 s of no further typing:start events
    this.typingService.setTyping(userId, dto.conversationId, () => {
      client.to(roomId).emit('typing:stop', {
        userId,
        conversationId: dto.conversationId,
        timestamp: Date.now(),
      });
    });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: TypingDto,
  ): void {
    const roomId = `conversation:${dto.conversationId}`;
    const userId = (client.data.user as { sub: string }).sub;

    // clearTyping fires the onStop callback which emits typing:stop
    this.typingService.clearTyping(userId, dto.conversationId);

    // If user was not registered as typing, still broadcast stop to be safe
    client.to(roomId).emit('typing:stop', {
      userId,
      conversationId: dto.conversationId,
      timestamp: Date.now(),
    });
  }

  /**
   * Emit a receipt when an on-chain transfer linked to a message is confirmed.
   */
  async sendMessageReceipt(
    conversationId: string,
    messageId: string,
    transactionId: string,
    txHash: string,
  ): Promise<void> {
    const roomId = `conversation:${conversationId}`;
    const event = {
      messageId,
      transactionId,
      txHash,
      status: 'CONFIRMED',
      timestamp: Date.now(),
    };

    await this.eventReplayService.storeEvent(roomId, 'message:receipt', event);
    this.server.to(roomId).emit('message:receipt', event);
  }

  async sendReactionAdded(
    conversationId: string,
    event: {
      messageId: string;
      conversationId: string;
      userId: string;
      emoji: string;
      timestamp: number;
    },
  ): Promise<void> {
    const roomId = `conversation:${conversationId}`;
    await this.eventReplayService.storeEvent(roomId, 'reaction:new', event);
    this.server.to(roomId).emit('reaction:new', event);
  }

  async sendReactionRemoved(
    conversationId: string,
    event: {
      messageId: string;
      conversationId: string;
      userId: string;
      emoji: string;
      timestamp: number;
    },
  ): Promise<void> {
    const roomId = `conversation:${conversationId}`;
    await this.eventReplayService.storeEvent(roomId, 'reaction:remove', event);
    this.server.to(roomId).emit('reaction:remove', event);
  }

  async sendExpenseNew(conversationId: string, expense: Record<string, unknown>): Promise<void> {
    const roomId = `conversation:${conversationId}`;
    await this.eventReplayService.storeEvent(roomId, 'expense:new', expense);
    this.server.to(roomId).emit('expense:new', expense);
  }

  async sendExpenseSettled(conversationId: string, expense: Record<string, unknown>): Promise<void> {
    const roomId = `conversation:${conversationId}`;
    await this.eventReplayService.storeEvent(roomId, 'expense:settled', expense);
    this.server.to(roomId).emit('expense:settled', expense);
  }

  emitMessagePinned(conversationId: string, payload: Record<string, unknown>): void {
    const roomId = `conversation:${conversationId}`;
    this.server.to(roomId).emit('message:pinned', payload);
  }

  emitMessageUnpinned(conversationId: string, payload: Record<string, unknown>): void {
    const roomId = `conversation:${conversationId}`;
    this.server.to(roomId).emit('message:unpinned', payload);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.headers.authorization;
    if (auth) {
      const [type, token] = auth.split(' ');
      return type === 'Bearer' ? token : null;
    }
    return (
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.query?.token as string | undefined) ??
      null
    );
  }
}
