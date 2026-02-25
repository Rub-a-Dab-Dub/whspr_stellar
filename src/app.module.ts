import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { APP_GUARD } from '@nestjs/core';
import { redisStore } from 'cache-manager-redis-store';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './user/user.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { User } from './user/entities/user.entity';
import { AdminModule } from './admin/admin.module';
import { MessagesModule } from './messages/messages.module';
import { PaymentsModule } from './payments/payments.module';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    // ── Configuration ──────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // ── Database ───────────────────────────────────────────────────────────
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_NAME', 'whspr'),
        entities: [User],
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
        logging: configService.get<string>('NODE_ENV') === 'development',
      }),
    }),

    // ── Redis Cache (nonces + refresh tokens) ──────────────────────────────
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        store: redisStore as any,
        host: configService.get<string>('REDIS_HOST', 'localhost'),
        port: configService.get<number>('REDIS_PORT', 6379),
        password: configService.get<string>('REDIS_PASSWORD'),
        ttl: 0, // Per-key TTL set by callers
      }),
    }),

    // ── Feature Modules ───────────────────────────────────────────────────
    AuthModule,
    UsersModule,
    AdminModule,
    PaymentsModule,
    MessagesModule,
    // AdminModule,
  ],

  providers: [
    // ── Guard chain (order matters): JWT first, then roles ─────────────────
    // JwtAuthGuard runs first: validates token / respects @Public()
    // RolesGuard runs second: checks role metadata against request.user
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
