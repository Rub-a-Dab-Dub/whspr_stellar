import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AdminRole } from '../enums/admin-role.enum';

export interface AdminJwtPayload {
  sub: string;
  email: string;
  role: AdminRole;
  isAdmin: boolean;
}

/**
 * Passport strategy for validating admin JWTs.
 * The strategy name 'admin-jwt' matches what AdminGuard extends.
 */
@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.ADMIN_JWT_SECRET || 'admin-secret',
    });
  }

  async validate(payload: AdminJwtPayload) {
    if (!payload.isAdmin) {
      throw new UnauthorizedException('Token is not an admin token');
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      isAdmin: payload.isAdmin,
    };
  }
}
