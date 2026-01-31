import { Module, OnModuleInit } from '@nestjs/common';
import { RedisThrottlerStorage } from '@nestjs-redis/throttler-storage';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import evmConfig from './config/evm.config';
import redisConfig from './config/redis.config';
import pinataConfig from './config/pinata.config';
import { validationSchema } from './config/validation.schema';
import { HealthModule } from './health/health.module';
import { MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { LoggerMiddleware } from './logger/logger.middleware';
import { UsersModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { RolesModule } from './roles/roles.module';
import { RedisModule } from './redis/redis.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { UserThrottlerGuard } from './common/guards/user-throttler.guard';

import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesSeederService } from './database/seeders/roles.seeder';
import { SessionModule } from './sessions/sessions.module';
import { MessageModule } from './message/message.module';
import { RewardsModule } from './rewards/rewards.module';
import { ChainModule } from './chain/chain.module';
import { TransferModule } from './transfer/transfer.module';
import { RoomModule } from './room/room.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SystemConfigModule } from './system-config/system-config.module';
import { QueueModule } from './queue/queue.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig, evmConfig, redisConfig, pinataConfig],
      validationSchema,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        ...configService.get('database'),
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: 60000,
            limit: 10,
          },
        ],
        storage: new RedisThrottlerStorage({
          host: config.get('REDIS_HOST'),
          port: config.get('REDIS_PORT'),
          password: config.get('REDIS_PASSWORD'),
          db: parseInt(config.get('REDIS_DB'), 10) || 0,
        }),
      }),
    }),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        transport: {
          host: configService.get('MAIL_HOST'),
          port: configService.get('MAIL_PORT'),
          secure: false,
          auth: {
            user: configService.get('MAIL_USER'),
            pass: configService.get('MAIL_PASSWORD'),
          },
        },
        defaults: {
          from: `"No Reply" <${configService.get('MAIL_FROM')}>`,
        },
        template: {
          dir: process.cwd() + '/templates/',
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
      inject: [ConfigService],
    }),
    HealthModule,
    RedisModule,
    QueueModule,
    AuthModule,
    UsersModule,
    RolesModule,
    AdminModule,
    SessionsModule,
    MessageModule,
    RewardsModule,
    ChainModule,
    TransferModule,
    RoomModule,
    NotificationsModule,
    SystemConfigModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // Apply JWT guard globally
    },
    {
      provide: APP_GUARD,
      useClass: UserThrottlerGuard, // Apply rate limiting globally (User + IP)
    },

  ],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly rolesSeeder: RolesSeederService) {}

  async onModuleInit() {
    // Seed roles and permissions on app initialization
    console.log('Seeding roles and permissions...');
    await this.rolesSeeder.seed();
    console.log('Roles and permissions seeded successfully!');
  }
}
