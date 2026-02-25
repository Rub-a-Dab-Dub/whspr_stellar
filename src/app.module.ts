import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { AppController } from './app.controller';
import { AppService } from './app.service';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // ── Database ───────────────────────────────────────────────────────────
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DATABASE_HOST', 'localhost'),
        port: configService.get<number>('DATABASE_PORT', 5432),
        username: configService.get<string>('DATABASE_USER', 'postgres'),
        password: configService.get<string>('DATABASE_PASS', 'postgres'),
        database: configService.get<string>('DATABASE_NAME', 'whspr'),
        autoLoadEntities: true,
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
        logging: configService.get<string>('NODE_ENV') === 'development',
      }),
    }),

    // ── Redis Cache ──────────────────────────────────────────────────────
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

    // ── Feature Modules ─────────────────────────────────────────────────
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
