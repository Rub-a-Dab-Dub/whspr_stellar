import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../user/user.service';
import { JwtPayload } from './jwt.strategy';
import { TranslationService } from '../../i18n/services/translation.service';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    private translationService: TranslationService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: JwtPayload) {
    const refreshToken = req.body?.refreshToken;
    const user = await this.usersService.findById(payload.sub);

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException(
        this.translationService.translate('errors.auth.invalidRefreshToken'),
      );
    }

    if (user.refreshToken !== refreshToken) {
      throw new UnauthorizedException(
        this.translationService.translate('errors.auth.refreshTokenMismatch'),
      );
    }

    return { userId: payload.sub, email: payload.email };
  }
}
