import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { RedisThrottlerStorage } from './common/redis/redis-throttler-storage';
import { RedisModule } from './common/redis/redis.module';
import { RedisService } from './common/redis/redis.service';
import { AdvancedThrottlerGuard } from './common/guards/advanced-throttler.guard';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { typeOrmConfig } from './config/typeorm.config';
import { envValidationSchema } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { WalletsModule } from './wallets/wallets.module';
import { LoggingModule } from './common/logging/logging.module';
import { ScheduledJobsModule } from './scheduled-jobs/scheduled-jobs.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { ObservabilityModule } from './observability/observability.module';
import { UserSettingsModule } from './user-settings/user-settings.module';
import { AdminModule } from './admin/admin.module';
import { AnalyticsModule } from './analytics/analytics.module';

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
    RedisModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule, RedisModule],
      inject: [ConfigService, RedisService],
      useFactory: (config: ConfigService, redisService: RedisService) => ({
        throttlers: [
          {
            name: 'short',
            ttl: 1000,
            limit: config.get<number>('THROTTLE_LIMIT_SHORT', 3),
          },
          {
            name: 'medium',
            ttl: 60000,
            limit: config.get<number>('THROTTLE_LIMIT_MEDIUM', 60),
          },
          {
            name: 'long',
            ttl: 3600000,
            limit: config.get<number>('THROTTLE_LIMIT_LONG', 1000),
          },
        ],
        storage: new RedisThrottlerStorage(redisService.getClient()),
      }),
    }),
    LoggingModule,
    ScheduleModule.forRoot(),
    HealthModule,
    UsersModule,
    UserSettingsModule,
    AuthModule,
    WalletsModule,
    AnalyticsModule,
    ScheduledJobsModule,
    WebhooksModule,
    ObservabilityModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AdvancedThrottlerGuard,
    },
  ],
})
export class AppModule {}
