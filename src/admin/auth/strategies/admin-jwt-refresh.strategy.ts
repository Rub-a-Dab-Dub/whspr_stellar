// src/admin/auth/strategies/admin-jwt-refresh.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../redis/redis.service';
import { AdminJwtPayload, ADMIN_ROLES } from './admin-jwt.strategy';

@Injectable()
export class AdminJwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'admin-jwt-refresh',
) {
  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('ADMIN_JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: AdminJwtPayload) {
    const refreshToken = req.body?.refreshToken as string;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is missing');
    }

    // Verify the stored refresh token matches
    const storedToken = await this.redisService.get(
      `admin:refresh:${payload.sub}`,
    );
    if (!storedToken || storedToken !== refreshToken) {
      throw new UnauthorizedException('Invalid or expired admin refresh token');
    }

    if (!payload.role || !ADMIN_ROLES.includes(payload.role)) {
      throw new UnauthorizedException('Token does not carry admin privileges');
    }

    return {
      adminId: payload.sub,
      email: payload.email,
      role: payload.role,
      jti: payload.jti,
    };
  }
}
