import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayload } from '../../auth/services/auth.service';
import { User } from '../../users/entities/user.entity';
import { RequestWithLocale } from '../interfaces/request-with-locale.interface';
import { parseAcceptLanguageHeader } from '../locales.constants';
import { LocaleContextService } from '../services/locale-context.service';
import { TranslationService } from '../services/translation.service';

@Injectable()
export class LocaleGuard implements CanActivate {
  private readonly logger = new Logger(LocaleGuard.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly translationService: TranslationService,
    private readonly localeContext: LocaleContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithLocale>();
    const locale = await this.resolveRequestLocale(request);

    request.locale = locale;
    request.i18nLang = locale;
    this.localeContext.setLocale(locale);

    return true;
  }

  private async resolveRequestLocale(request: RequestWithLocale): Promise<string> {
    const requestUserLocale = this.translationService.normalizeSupportedLocale(
      request.user?.preferredLocale,
    );
    if (requestUserLocale) {
      return requestUserLocale;
    }

    const persistedUserLocale = await this.resolveUserLocaleFromToken(request);
    if (persistedUserLocale) {
      return persistedUserLocale;
    }

    const headerLocale = parseAcceptLanguageHeader(
      request.headers['accept-language'],
      this.translationService.getSupportedLocales(),
    );

    return headerLocale ?? this.translationService.resolveLocale();
  }

  private async resolveUserLocaleFromToken(
    request: RequestWithLocale,
  ): Promise<string | null> {
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      return null;
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      if (!payload?.sub) {
        return null;
      }

      const user = await this.usersRepository.findOne({
        where: { id: payload.sub },
      });

      return this.translationService.normalizeSupportedLocale(user?.preferredLocale);
    } catch (error) {
      this.logger.debug(
        `Locale resolution skipped for invalid token: ${this.getErrorMessage(error)}`,
      );
      return null;
    }
  }

  private extractBearerToken(authorizationHeader?: string): string | null {
    if (!authorizationHeader) {
      return null;
    }

    const [scheme, token] = authorizationHeader.split(' ');
    return scheme === 'Bearer' && token ? token : null;
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
