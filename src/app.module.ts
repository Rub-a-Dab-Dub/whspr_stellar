import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { typeOrmConfig } from './config/typeorm.config';
import { envValidationSchema } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ReportsModule } from './reports/reports.module';
import { WalletsModule } from './wallets/wallets.module';
import { LoggingModule } from './common/logging/logging.module';
import { ScheduledJobsModule } from './scheduled-jobs/scheduled-jobs.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { ObservabilityModule } from './observability/observability.module';
import { UserSettingsModule } from './user-settings/user-settings.module';
import { SorobanModule } from './soroban/soroban.module';
import { KycModule } from './kyc/kyc.module';
import { TokensModule } from './tokens/tokens.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: true,
      },
    }),
    TypeOrmModule.forRootAsync({
      useFactory: typeOrmConfig,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),
    LoggingModule,
    ScheduleModule.forRoot(),
    HealthModule,
    UsersModule,
    UserSettingsModule,
    AuthModule,
    SessionsModule,
    WalletsModule,
    AnalyticsModule,
    ScheduledJobsModule,
    WebhooksModule,
    ObservabilityModule,
    UserSettingsModule,
    SorobanModule,
    KycModule,
    TokensModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
