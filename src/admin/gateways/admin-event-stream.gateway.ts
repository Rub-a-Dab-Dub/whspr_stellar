import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { UserRole } from '../../roles/entities/role.entity';
import type { AdminStreamEventPayload } from '../events/admin-stream.events';

export const ADMIN_STREAM_EVENTS = {
  USER_BANNED: 'admin.stream.user.banned',
  USER_REGISTERED: 'admin.stream.user.registered',
  TRANSACTION_LARGE: 'admin.stream.transaction.large',
  ROOM_FLAGGED: 'admin.stream.room.flagged',
  PLATFORM_ERROR: 'admin.stream.platform.error',
} as const;

@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN || '*', credentials: true },
  namespace: '/admin/ws',
})
export class AdminEventStreamGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AdminEventStreamGateway.name);
  private readonly adminSockets = new Set<string>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      // Support token from query param (per spec) or auth
      const token =
        (client.handshake.query.token as string) ||
        (client.handshake.auth?.token as string);

      if (!token) {
        this.logger.warn('Admin WS: connection rejected - no token');
        client.disconnect();
        return;
      }

      const decoded = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_ACCESS_SECRET'),
      });
      const userId = decoded.sub || decoded.id;

      if (!userId) {
        this.logger.warn('Admin WS: invalid token payload');
        client.disconnect();
        return;
      }

      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['roles'],
      });

      if (!user) {
        this.logger.warn(`Admin WS: user ${userId} not found`);
        client.disconnect();
        return;
      }

      const isAdmin = (user.roles || []).some(
        (r) => r.name === UserRole.ADMIN || r.name === UserRole.SUPER_ADMIN,
      );

      if (!isAdmin) {
        this.logger.warn(`Admin WS: user ${userId} is not admin`);
        client.disconnect();
        return;
      }

      this.adminSockets.add(client.id);
      client.data.adminId = userId;
      this.logger.log(
        `Admin ${userId} connected to event stream (${client.id})`,
      );
    } catch (error) {
      this.logger.warn(`Admin WS: auth failed - ${(error as Error).message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.adminSockets.delete(client.id);
    this.logger.log(`Admin disconnected from event stream (${client.id})`);
  }

  private broadcast(payload: AdminStreamEventPayload): void {
    const event = {
      ...payload,
      timestamp: payload.timestamp || new Date().toISOString(),
    };
    this.adminSockets.forEach((socketId) => {
      const socket = this.server.sockets.sockets.get(socketId);
      if (socket?.connected) {
        socket.emit('event', event);
      }
    });
  }

  @OnEvent(ADMIN_STREAM_EVENTS.USER_BANNED)
  onUserBanned(payload: AdminStreamEventPayload): void {
    this.broadcast(payload);
  }

  @OnEvent(ADMIN_STREAM_EVENTS.USER_REGISTERED)
  onUserRegistered(payload: AdminStreamEventPayload): void {
    this.broadcast(payload);
  }

  @OnEvent(ADMIN_STREAM_EVENTS.TRANSACTION_LARGE)
  onTransactionLarge(payload: AdminStreamEventPayload): void {
    this.broadcast(payload);
  }

  @OnEvent(ADMIN_STREAM_EVENTS.ROOM_FLAGGED)
  onRoomFlagged(payload: AdminStreamEventPayload): void {
    this.broadcast(payload);
  }

  @OnEvent(ADMIN_STREAM_EVENTS.PLATFORM_ERROR)
  onPlatformError(payload: AdminStreamEventPayload): void {
    this.broadcast(payload);
  }
}
