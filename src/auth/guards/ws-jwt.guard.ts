import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    try {
      const client: Socket = context.switchToWs().getClient();
      const token = client.handshake.auth.token;

      if (!token) {
        return false;
      }

      const decoded = this.jwtService.verify(token);
      const userId = decoded.sub || decoded.id;

      if (!userId) {
        return false;
      }

      // Store userId in socket data for easy access
      client.data.userId = userId;
      return true;
    } catch (error) {
      return false;
    }
  }
}