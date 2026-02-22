import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class JwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('No token found');
    }

    try {
      // In a real implementation, verify the JWT token here
      // For now, we're just checking that the token exists
      // import { verify } from 'jsonwebtoken';
      // const decoded = verify(token, process.env.JWT_SECRET);
      // request.user = decoded;

      // Mock implementation
      request.user = {
        id: 'user-id',
        email: 'user@example.com',
        roles: ['ADMIN'],
      };

      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractToken(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return undefined;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return undefined;
    }

    return parts[1];
  }
}
