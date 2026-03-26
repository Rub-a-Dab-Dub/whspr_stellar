import { Logger, Injectable } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService, JwtPayload } from '../auth/services/auth.service';
import { ADMIN_CONFIG_WS_NAMESPACE, ADMIN_CONFIG_WS_ROOM } from './constants';
import type { UserResponseDto } from '../users/dto/user-response.dto';

@WebSocketGateway({ namespace: ADMIN_CONFIG_WS_NAMESPACE, cors: { origin: '*' } })
@Injectable()
export class AdminConfigGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AdminConfigGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {}

  notifyConfigChanged(keys: string[]): void {
    if (!this.server) return;
    this.server.to(ADMIN_CONFIG_WS_ROOM).emit('config:updated', {
      keys,
      at: Date.now(),
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) throw new Error('No token');

      const verified = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const user = await this.authService.validateUser(verified);
      if (!this.isAdmin(user)) {
        throw new Error('Not admin');
      }

      client.data.user = user;
      await client.join(ADMIN_CONFIG_WS_ROOM);
      this.logger.log(
        `[${ADMIN_CONFIG_WS_NAMESPACE}] admin connected socket=${client.id} user=${user.id}`,
      );
    } catch {
      this.logger.warn(
        `[${ADMIN_CONFIG_WS_NAMESPACE}] rejected socket ${client.id}`,
      );
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const user = client.data?.user as UserResponseDto | undefined;
    if (user) {
      this.logger.log(
        `[${ADMIN_CONFIG_WS_NAMESPACE}] disconnected socket=${client.id} user=${user.id}`,
      );
    }
  }

  private isAdmin(user: UserResponseDto): boolean {
    const allowedUserIds = this.readCsv('ADMIN_USER_IDS');
    const allowedWallets = this.readCsv('ADMIN_WALLET_ADDRESSES');
    const userId = user.id ? user.id.toLowerCase() : '';
    const wallet = user.walletAddress ? user.walletAddress.toLowerCase() : '';
    return (
      (Boolean(userId) && allowedUserIds.includes(userId)) ||
      (Boolean(wallet) && allowedWallets.includes(wallet))
    );
  }

  private readCsv(envKey: string): string[] {
    const raw = this.configService.get<string>(envKey, '');
    return raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
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
