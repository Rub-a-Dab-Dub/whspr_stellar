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
import { BadRequestException, Logger } from '@nestjs/common';
import { MessageService } from '../message.service';
import { CreateMessageDto } from '../dto/create-message.dto';
import { ProfanityFilterService } from '../services/profanity-filter.service';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
  namespace: '/messages',
})
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private logger = new Logger('MessagesGateway');
  private userSockets = new Map<string, Set<string>>();
  private roomMembers = new Map<string, Set<string>>();

  constructor(
    private messageService: MessageService,
    private profanityFilterService: ProfanityFilterService,
    private jwtService: JwtService,
  ) {}

  handleConnection(client: Socket): void {
    try {
      const token = client.handshake.auth.token as string;
      if (!token) {
        client.disconnect();
        return;
      }

      const decoded = this.jwtService.verify(token) as Record<string, string>;
      const userId = decoded.sub || decoded.id;

      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)?.add(client.id);

      this.logger.log(`User ${userId} connected with socket ${client.id}`);
    } catch (error) {
      this.logger.error('Connection error:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.userSockets.forEach((sockets, userId) => {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    });

    this.roomMembers.forEach((members) => {
      members.delete(client.id);
    });

    this.logger.log(`Client ${client.id} disconnected`);
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string },
  ): Record<string, unknown> {
    const { roomId, userId } = data;

    if (!roomId || !userId) {
      throw new BadRequestException('roomId and userId are required');
    }

    void client.join(`room:${roomId}`);

    if (!this.roomMembers.has(roomId)) {
      this.roomMembers.set(roomId, new Set());
    }
    this.roomMembers.get(roomId)?.add(userId);

    this.server.to(`room:${roomId}`).emit('user-joined', {
      userId,
      timestamp: new Date(),
    });

    this.logger.log(`User ${userId} joined room ${roomId}`);

    return {
      success: true,
      message: `Joined room ${roomId}`,
    };
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string },
  ): Record<string, unknown> {
    const { roomId, userId } = data;

    void client.leave(`room:${roomId}`);

    const members = this.roomMembers.get(roomId);
    if (members) {
      members.delete(userId);
      if (members.size === 0) {
        this.roomMembers.delete(roomId);
      }
    }

    this.server.to(`room:${roomId}`).emit('user-left', {
      userId,
      timestamp: new Date(),
    });

    this.logger.log(`User ${userId} left room ${roomId}`);

    return {
      success: true,
      message: `Left room ${roomId}`,
    };
  }

  @SubscribeMessage('send-message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() createMessageDto: CreateMessageDto,
  ): Promise<Record<string, unknown>> {
    try {
      const { roomId } = createMessageDto;
      const members = this.roomMembers.get(roomId);

      if (!members || members.size === 0) {
        throw new BadRequestException('User is not a member of this room');
      }

      if (
        this.profanityFilterService.containsProfanity(
          createMessageDto.content,
        )
      ) {
        throw new BadRequestException('Message contains profanity');
      }

      const token = client.handshake.auth.token as string;
      const decoded = this.jwtService.verify(token) as Record<string, string>;
      const userId = decoded.sub || decoded.id;

      const message = await this.messageService.createMessage(
        createMessageDto,
        userId,
      );

      this.server.to(`room:${roomId}`).emit('message-created', message);

      this.logger.log(`Message created in room ${roomId} by user ${userId}`);

      return {
        success: true,
        message,
      };
    } catch (error) {
      this.logger.error('Error sending message:', error);
      throw error;
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string; isTyping: boolean },
  ): void {
    const { roomId, userId, isTyping } = data;

    this.server.to(`room:${roomId}`).emit('user-typing', {
      userId,
      isTyping,
      timestamp: new Date(),
    });
  }

  @SubscribeMessage('get-room-members')
  handleGetRoomMembers(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ): Record<string, unknown> {
    const { roomId } = data;
    const members = Array.from(this.roomMembers.get(roomId) || []);

    return {
      success: true,
      roomId,
      members,
      memberCount: members.length,
    };
  }

  broadcastToRoom(
    roomId: string,
    event: string,
    data: any,
  ): void {
    this.server.to(`room:${roomId}`).emit(event, data);
  }

  broadcastToUser(
    userId: string,
    event: string,
    data: any,
  ): void {
    const userSockets = this.userSockets.get(userId);
    if (userSockets) {
      userSockets.forEach((socketId) => {
        this.server.to(socketId).emit(event, data);
      });
    }
  }

  isUserInRoom(roomId: string, userId: string): boolean {
    const members = this.roomMembers.get(roomId);
    return members ? members.has(userId) : false;
  }
}
