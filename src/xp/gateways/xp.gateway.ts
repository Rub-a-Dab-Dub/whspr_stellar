import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

export const XP_EVENTS = {
  LEVEL_UP: 'user.level_up',
} as const;

export interface LevelUpPayload {
  userId: string;
  previousLevel: number;
  newLevel: number;
  xpTotal: number;
  reason: string;
}

@WebSocketGateway({
  namespace: '/xp',
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
})
export class XpGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(XpGateway.name);
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket) {
    try {
      const token = (client.handshake.auth as { token?: string })?.token;
      if (!token) {
        this.logger.warn('XP client connected without token');
        client.disconnect();
        return;
      }
      const decoded = this.jwtService.verify(token) as { sub?: string };
      const userId = decoded.sub;
      if (!userId) {
        this.logger.warn('Invalid XP token payload');
        client.disconnect();
        return;
      }
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);
      client.join(`user:${userId}`);
      (client as any).data = { userId };
      this.logger.log(`User ${userId} connected to /xp (socket ${client.id})`);
    } catch {
      this.logger.error('XP gateway connection error');
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = (client as any).data?.userId as string | undefined;
    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) this.userSockets.delete(userId);
      }
    }
    this.logger.log(`XP client ${client.id} disconnected`);
  }

  emitLevelUp(payload: LevelUpPayload): void {
    this.server.to(`user:${payload.userId}`).emit(XP_EVENTS.LEVEL_UP, payload);
    this.logger.log(
      `user.level_up emitted → userId=${payload.userId} ` +
        `level ${payload.previousLevel} → ${payload.newLevel}`,
    );
  }
}
