import * as path from 'path';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { I18nJsonLoader, I18nModule } from 'nestjs-i18n';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { LoggingModule } from '../common/logging/logging.module';
import { User } from '../users/entities/user.entity';
import { DEFAULT_LOCALE } from './locales.constants';
import { LocaleGuard } from './guards/locale.guard';
import { LocalizedParseUUIDPipe } from './pipes/localized-parse-uuid.pipe';
import { LocalizedValidationPipe } from './pipes/localized-validation.pipe';
import { EmailContentService } from './services/email-content.service';
import { LocaleContextService } from './services/locale-context.service';
import { NotificationContentService } from './services/notification-content.service';
import { TranslationService } from './services/translation.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
    I18nModule.forRoot({
      fallbackLanguage: DEFAULT_LOCALE,
      loader: I18nJsonLoader,
      loaderOptions: {
        path: path.join(__dirname, 'locales'),
        watch: process.env.NODE_ENV !== 'production',
      },
      disableMiddleware: true,
      logging: false,
    }),
  ],
  providers: [
    LocaleContextService,
    TranslationService,
    NotificationContentService,
    EmailContentService,
    LocalizedValidationPipe,
    LocalizedParseUUIDPipe,
    HttpExceptionFilter,
    LocaleGuard,
    {
      provide: APP_GUARD,
      useExisting: LocaleGuard,
    },
    {
      provide: APP_PIPE,
      useExisting: LocalizedValidationPipe,
    },
    {
      provide: APP_FILTER,
      useExisting: HttpExceptionFilter,
    },
  ],
  exports: [
    TranslationService,
    LocaleContextService,
    NotificationContentService,
    EmailContentService,
    LocalizedValidationPipe,
    LocalizedParseUUIDPipe,
  ],
})
export class AppI18nModule {}
