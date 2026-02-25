import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule as AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { RequestLoggingMiddleware } from './common/middleware/request-logging.middleware';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { AdminModule } from './admin/admin.module';
import { PaymentsModule } from './payments/payments.module';
import { MessagesModule } from './messages/messages.module';
import { RoomsModule } from './rooms/rooms.module';
import { SessionKeysModule } from './session-keys/session-keys.module';
import { XpModule } from './xp/xp.module';
import { HealthModule } from './health/health.module';
import { QueuesModule } from './queues/queues.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { SecurityModule } from './security/security.module';
import { SeedModule } from './database/seeds/seed.module';
import { CacheModule as CustomCacheModule } from './cache/cache.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    AppConfigModule,

    DatabaseModule,
    RedisModule,

    // Redis Cache (Nest CacheModule for existing cache.service)
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        host: configService.get<string>('REDIS_HOST', 'localhost'),
        port: configService.get<number>('REDIS_PORT', 6379),
        password: configService.get<string>('REDIS_PASSWORD'),
        ttl: 0,
      }),
    }),

    AuthModule,
    UserModule,
    AdminModule,
    PaymentsModule,
    MessagesModule,
    RoomsModule,
    SessionKeysModule,
    XpModule,
    HealthModule,
    QueuesModule,
    RateLimitModule,
    SecurityModule,
    SeedModule,
    CustomCacheModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
  }
}
