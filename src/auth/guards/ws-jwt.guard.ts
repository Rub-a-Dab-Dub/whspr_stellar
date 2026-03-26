import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { AuthService, JwtPayload } from '../services/auth.service';
import { TranslationService } from '../../i18n/services/translation.service';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    private readonly translationService: TranslationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient<Socket>();
      const token = this.extractTokenFromHandshake(client);

      if (!token) {
        throw new WsException(
          this.translationService.translate('errors.auth.wsTokenNotFound'),
        );
      }

      const payload: JwtPayload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const user = await this.authService.validateUser(payload);

      // Attach user to socket for later use
      client.data.user = user;

      return true;
    } catch (error) {
      if (error instanceof WsException) {
        throw error;
      }

      throw new WsException(
        this.translationService.translate('errors.auth.wsInvalidOrExpiredToken'),
      );
    }
  }

  private extractTokenFromHandshake(client: Socket): string | null {
    const authHeader = client.handshake.headers.authorization;

    if (!authHeader) {
      // Try to get token from query params
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      return token as string | null;
    }

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : null;
  }
}
