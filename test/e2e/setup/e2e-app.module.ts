import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { envValidationSchema } from '../../../src/config/env.validation';
import { testDbConfig } from './test-db.config';
import { AppI18nModule } from '../../../src/i18n/app-i18n.module';
import { UserSettingsModule } from '../../../src/user-settings/user-settings.module';
import { UsersModule } from '../../../src/users/users.module';
import { SessionsModule } from '../../../src/sessions/sessions.module';
import { AuthModule } from '../../../src/auth/auth.module';
import { WalletsModule } from '../../../src/wallets/wallets.module';
import { InChatTransfersModule } from '../../../src/in-chat-transfers/in-chat-transfers.module';
import { WebhooksModule } from '../../../src/webhooks/webhooks.module';
import { AdminModule } from '../../../src/admin/admin.module';
import { AppVersionModule } from '../../../src/app-version/app-version.module';
import { CacheModule } from '../../../src/cache/cache.module';
import { DidModule } from '../../../src/did/did.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      validationSchema: envValidationSchema,
    }),
    TypeOrmModule.forRoot(testDbConfig),
    AppI18nModule,
    UserSettingsModule,
    UsersModule,
    SessionsModule,
    AuthModule,
    WalletsModule,
    InChatTransfersModule,
    WebhooksModule,
    AdminModule,
    CacheModule,
    AppVersionModule,
    DidModule,
  ],
})
export class E2eAppModule {}
