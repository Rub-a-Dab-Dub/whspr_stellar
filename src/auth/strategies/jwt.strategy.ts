import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../user/user.service';
import { RedisService } from '../../redis/redis.service';
import { TranslationService } from '../../i18n/services/translation.service';

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
    private translationService: TranslationService,
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
      throw new UnauthorizedException(
        this.translationService.translate('errors.auth.tokenRevoked'),
      );
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException(
        this.translationService.translate('errors.users.notFound'),
      );
    }

    if (user.isLocked) {
      throw new UnauthorizedException(
        this.translationService.translate('errors.auth.accountLocked'),
      );
    }

    // Check if user is banned or suspended
    if (user.isBanned) {
      throw new UnauthorizedException(
        this.translationService.translate('errors.auth.accountBanned'),
      );
    }

    if (user.suspendedUntil && user.suspendedUntil > new Date()) {
      throw new UnauthorizedException(
        this.translationService.translate('errors.auth.accountSuspended'),
      );
    }

    return {
      userId: payload.sub,
      email: payload.email,
      preferredLocale: user.preferredLocale,
      user, // Include full user object with roles
    };
  }
}
