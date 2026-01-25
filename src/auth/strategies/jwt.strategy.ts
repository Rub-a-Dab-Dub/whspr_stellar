import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../user/user.service';
import { RedisService } from '../../redis/redis.service';

export interface JwtPayload {
  sub: string;
  email: string;
  jti: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    private redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    // Check if token is blacklisted
    const isBlacklisted = await this.redisService.exists(
      `blacklist:${payload.jti}`,
    );
    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.isLocked) {
      throw new UnauthorizedException('Account is locked');
    }

    // Check if user is banned or suspended
    if (user.isBanned) {
      throw new UnauthorizedException('Account is banned');
    }

    if (user.suspendedUntil && user.suspendedUntil > new Date()) {
      throw new UnauthorizedException('Account is suspended');
    }

    return { 
      userId: payload.sub, 
      email: payload.email,
      user, // Include full user object with roles
    };
  }
}