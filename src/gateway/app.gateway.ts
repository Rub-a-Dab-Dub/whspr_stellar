import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../redis/redis.service';

interface SocketJwtPayload {
  userId?: string;
  sub?: string;
  id?: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
  pingInterval: 30000,
  pingTimeout: 10000,
})
@Injectable()
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AppGateway.name);
  private readonly disconnectTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        client.handshake.auth?.token ||
        this.extractBearer(client.handshake.headers?.authorization as
          | string
          | undefined);

      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify<SocketJwtPayload>(token, {
        secret: process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET,
      });
      const userId = payload.userId || payload.sub || payload.id;

      if (!userId) {
        client.disconnect(true);
        return;
      }

      const existingTimer = this.disconnectTimers.get(userId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.disconnectTimers.delete(userId);
      }

      await this.redisService.hset(`presence:${userId}`, {
        userId,
        socketId: client.id,
        connectedAt: new Date().toISOString(),
      });

      client.data.userId = userId;
      this.logger.debug(`Connected socket ${client.id} for user ${userId}`);
    } catch (error) {
      this.logger.warn(`Unauthorized socket connection: ${client.id}`);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const userId = client.data.userId as string | undefined;
    if (!userId) {
      return;
    }

    const timer = setTimeout(() => {
      void this.cleanupPresence(userId);
    }, 30000);

    this.disconnectTimers.set(userId, timer);
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @MessageBody() data: { room: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const userId = client.data.userId as string | undefined;
    const room = data?.room?.trim();

    if (!userId || !room) {
      return;
    }

    await client.join(room);
    await this.redisService.sadd(`online_users:${room}`, userId);
    await this.redisService.sadd(`user_rooms:${userId}`, room);
  }

  @SubscribeMessage('leave_room')
  async handleLeaveRoom(
    @MessageBody() data: { room: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const userId = client.data.userId as string | undefined;
    const room = data?.room?.trim();

    if (!userId || !room) {
      return;
    }

    await client.leave(room);
    await this.redisService.srem(`online_users:${room}`, userId);
    await this.redisService.srem(`user_rooms:${userId}`, room);
  }

  private async cleanupPresence(userId: string): Promise<void> {
    try {
      await this.redisService.del(`presence:${userId}`);

      const rooms = await this.redisService.smembers(`user_rooms:${userId}`);
      await Promise.all(
        rooms.map((room) =>
          this.redisService.srem(`online_users:${room}`, userId),
        ),
      );
      await this.redisService.del(`user_rooms:${userId}`);
    } finally {
      this.disconnectTimers.delete(userId);
    }
  }

  private extractBearer(authorization?: string): string | undefined {
    if (!authorization) {
      return undefined;
    }

    const [scheme, token] = authorization.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return undefined;
    }

    return token;
  }
}
