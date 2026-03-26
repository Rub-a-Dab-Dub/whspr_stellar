import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventReplayService } from '../services/event-replay.service';
import { NotificationDto, TransferUpdateDto } from '../dto/notification-events.dto';

@WebSocketGateway({ namespace: '/notifications', cors: { origin: '*' } })
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly eventReplayService: EventReplayService,
  ) {}

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) throw new Error('No token');

      const payload = this.jwtService.verify<{ sub: string }>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      client.data.user = payload;

      // Each user subscribes to their own isolated notification room
      const userRoom = this.userRoom(payload.sub);
      await client.join(userRoom);

      // Replay missed notifications on reconnect
      const lastTs = parseInt(
        client.handshake.query?.lastEventTimestamp as string,
        10,
      );
      if (!isNaN(lastTs)) {
        const missed = await this.eventReplayService.getMissedEvents(userRoom, lastTs);
        for (const e of missed) {
          client.emit(e.event, e.data);
        }
        this.logger.log(
          `[/notifications] replayed ${missed.length} missed events → user=${payload.sub}`,
        );
      }

      this.logger.log(
        `[/notifications] connected socket=${client.id} user=${payload.sub}`,
      );
    } catch {
      this.logger.warn(`[/notifications] rejected unauthorized socket ${client.id}`);
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const user = client.data?.user as { sub: string } | undefined;
    if (user) {
      this.logger.log(
        `[/notifications] disconnected socket=${client.id} user=${user.sub}`,
      );
    }
  }

  // ─── Public API (called by other services) ──────────────────────────────────

  /**
   * Push a notification to a specific user.
   * Stores the event for replay and emits to all open connections for that user.
   */
  async sendNotification(userId: string, notification: NotificationDto): Promise<void> {
    const room = this.userRoom(userId);
    const event = { ...notification, timestamp: Date.now() };
    await this.eventReplayService.storeEvent(room, 'notification:new', event);
    this.server.to(room).emit('notification:new', event);
  }

  /**
   * Push a transfer status update to a specific user.
   */
  async sendTransferUpdate(userId: string, transfer: TransferUpdateDto): Promise<void> {
    const room = this.userRoom(userId);
    const event = { ...transfer, timestamp: Date.now() };
    await this.eventReplayService.storeEvent(room, 'transfer:update', event);
    this.server.to(room).emit('transfer:update', event);
  }

  async sendNotificationRead(
    userId: string,
    notificationId: string,
    readAt: number,
  ): Promise<void> {
    const room = this.userRoom(userId);
    const event = { notificationId, readAt, timestamp: Date.now() };
    await this.eventReplayService.storeEvent(room, 'notification:read', event);
    this.server.to(room).emit('notification:read', event);
  }

  async sendNotificationReadAll(userId: string): Promise<void> {
    const room = this.userRoom(userId);
    const event = { timestamp: Date.now() };
    await this.eventReplayService.storeEvent(room, 'notification:read_all', event);
    this.server.to(room).emit('notification:read_all', event);
  }

  async sendNotificationDeleted(userId: string, notificationId: string): Promise<void> {
    const room = this.userRoom(userId);
    const event = { notificationId, timestamp: Date.now() };
    await this.eventReplayService.storeEvent(room, 'notification:deleted', event);
    this.server.to(room).emit('notification:deleted', event);
  }

  async sendUnreadCountUpdate(userId: string, unreadCount: number): Promise<void> {
    const room = this.userRoom(userId);
    const event = { unreadCount, timestamp: Date.now() };
    await this.eventReplayService.storeEvent(room, 'notification:unread_count', event);
    this.server.to(room).emit('notification:unread_count', event);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private userRoom(userId: string): string {
    return `notifications:${userId}`;
  }

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
