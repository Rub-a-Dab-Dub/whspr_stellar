import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Message, MessageType } from './entities/message.entity';

// ─── Event name constants ────────────────────────────────────────────────────

export const MSG_EVENTS = {
  /** Client → Server: subscribe to a room channel */
  ROOM_SUBSCRIBE: 'room.subscribe',
  /** Client → Server: unsubscribe from a room channel */
  ROOM_UNSUBSCRIBE: 'room.unsubscribe',
  /** Client → Server: send a new message */
  MESSAGE_SEND: 'message.send',
  /** Client → Server: mark a message as read */
  MESSAGE_READ: 'message.read',

  /** Server → Client: broadcast new message to room subscribers */
  MESSAGE_RECEIVED: 'message.received',
  /** Server → Client: message delivery confirmed back to sender */
  MESSAGE_DELIVERED: 'message.delivered',
  /** Server → Client: someone edited a message */
  MESSAGE_EDITED: 'message.edited',
  /** Server → Client: someone deleted a message */
  MESSAGE_DELETED: 'message.deleted',
  /** Server → Client: a user's read-receipt update */
  MESSAGE_READ_ACK: 'message.read_ack',
} as const;

// ─── Payloads ────────────────────────────────────────────────────────────────

export interface SubscribeRoomPayload {
  roomId: string;
}

export interface SendMessagePayloadWs {
  roomId: string;
  content?: string;
  type?: MessageType;
  ipfsHash?: string;
  replyToId?: string;
}

export interface ReadReceiptPayload {
  roomId: string;
  messageId: string;
}

// ─── Gateway ─────────────────────────────────────────────────────────────────

/**
 * MessagesGateway – Socket.IO namespace /messages
 *
 * Connection flow:
 *  1. Client connects with   { auth: { token: "<JWT>" } }
 *  2. Server verifies JWT, stores userId in socket.data.userId
 *  3. Client emits  room.subscribe  { roomId }  → socket joins room channel
 *  4. Client emits  message.send    { roomId, content, … }
 *     → Message persisted via MessagesService.persistAndBroadcast()
 *     → room channel receives  message.received
 *     → sender receives        message.delivered  (ack)
 */
@WebSocketGateway({
  namespace: '/messages',
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
})
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagesGateway.name);

  // Lazy reference to break circular dep (MessagesGateway ↔ MessagesService)
  private messagesServiceRef: {
    persistAndBroadcast: (
      senderId: string,
      payload: SendMessagePayloadWs,
    ) => Promise<Message>;
  } | null = null;

  constructor(private readonly jwtService: JwtService) {}

  /** Called by MessagesModule after both providers are instantiated */
  setMessagesService(svc: MessagesGateway['messagesServiceRef']) {
    this.messagesServiceRef = svc;
  }

  // ─── Connection lifecycle ─────────────────────────────────────────────────

  handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth as { token?: string })?.token ??
        (client.handshake.headers['authorization'] as string | undefined)
          ?.split(' ')
          .at(1);

      if (!token) {
        this.logger.warn(`[/messages] no token – disconnecting ${client.id}`);
        client.emit('error', { message: 'Authentication token required' });
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify<{ sub: string }>(token);
      if (!payload?.sub) {
        throw new UnauthorizedException('Invalid token payload');
      }

      client.data.userId = payload.sub;
      // Auto-join a personal channel so we can target this user directly
      void client.join(`user:${payload.sub}`);

      this.logger.log(
        `[/messages] connected: userId=${payload.sub} sock=${client.id}`,
      );
    } catch {
      this.logger.warn(`[/messages] auth failed – disconnecting ${client.id}`);
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(
      `[/messages] disconnected: userId=${client.data?.userId} sock=${client.id}`,
    );
  }

  // ─── Room subscription ────────────────────────────────────────────────────

  @SubscribeMessage(MSG_EVENTS.ROOM_SUBSCRIBE)
  async handleRoomSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SubscribeRoomPayload,
  ) {
    if (!payload?.roomId) return;
    await client.join(`room_${payload.roomId}`);
    this.logger.debug(
      `userId=${client.data.userId} joined room_${payload.roomId}`,
    );
    return { event: MSG_EVENTS.ROOM_SUBSCRIBE, data: { ok: true } };
  }

  @SubscribeMessage(MSG_EVENTS.ROOM_UNSUBSCRIBE)
  async handleRoomUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SubscribeRoomPayload,
  ) {
    if (!payload?.roomId) return;
    await client.leave(`room_${payload.roomId}`);
    this.logger.debug(
      `userId=${client.data.userId} left room_${payload.roomId}`,
    );
    return { event: MSG_EVENTS.ROOM_UNSUBSCRIBE, data: { ok: true } };
  }

  // ─── Send message ─────────────────────────────────────────────────────────

  @SubscribeMessage(MSG_EVENTS.MESSAGE_SEND)
  async handleMessageSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessagePayloadWs,
  ) {
    const userId = client.data?.userId as string | undefined;

    if (!userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    if (!payload?.roomId) {
      client.emit('error', { message: 'roomId is required' });
      return;
    }

    if (!this.messagesServiceRef) {
      client.emit('error', { message: 'Messaging service unavailable' });
      return;
    }

    try {
      const saved = await this.messagesServiceRef.persistAndBroadcast(
        userId,
        payload,
      );

      // Delivery ack – sent only to the originating socket
      client.emit(MSG_EVENTS.MESSAGE_DELIVERED, {
        messageId: saved.id,
        roomId: saved.roomId,
        createdAt: saved.createdAt,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to send message';
      client.emit('error', { message });
    }
  }

  // ─── Read receipt ─────────────────────────────────────────────────────────

  @SubscribeMessage(MSG_EVENTS.MESSAGE_READ)
  handleMessageRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ReadReceiptPayload,
  ) {
    const userId = client.data?.userId as string | undefined;
    if (!userId || !payload?.messageId || !payload?.roomId) return;

    // Broadcast the read receipt to everyone in the room (sender can update UI)
    this.server.to(`room_${payload.roomId}`).emit(MSG_EVENTS.MESSAGE_READ_ACK, {
      userId,
      messageId: payload.messageId,
      roomId: payload.roomId,
      readAt: new Date().toISOString(),
    });
  }

  // ─── Server-side broadcast helpers (used by MessagesService) ─────────────

  /**
   * Broadcast a persisted message to all subscribers of a room.
   * Called by MessagesService.persistAndBroadcast() after the DB save.
   */
  broadcastMessage(roomId: string, message: Message): void {
    this.server.to(`room_${roomId}`).emit(MSG_EVENTS.MESSAGE_RECEIVED, message);
  }

  emitMessageEdited(
    roomId: string,
    messageId: string,
    newContent: string,
    editedAt: Date,
  ) {
    this.server.to(`room_${roomId}`).emit(MSG_EVENTS.MESSAGE_EDITED, {
      messageId,
      content: newContent,
      editedAt,
      roomId,
    });
  }

  emitMessageDeleted(roomId: string, messageId: string) {
    this.server.to(`room_${roomId}`).emit(MSG_EVENTS.MESSAGE_DELETED, {
      messageId,
      roomId,
    });
  }

  /** Legacy helper kept for compatibility */
  joinRoom(client: Socket, roomId: string) {
    void client.join(`room_${roomId}`);
  }
}
