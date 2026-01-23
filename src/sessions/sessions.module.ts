// src/sessions/session.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import * as redisStore from 'cache-manager-redis-store';

import { Session } from './entities/session.entity';
import { SessionRepository } from './repositories/session.repository';
import { RedisSessionService } from './services/redis-session.service';
import { DeviceParserService } from './services/device-parser.service';
import { SessionCleanupJob } from './jobs/session-cleanup.job';
import { SessionController } from './sessions.controller';
import { SessionService } from './services/sessions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Session]),
    ScheduleModule.forRoot(),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION', '1h'),
        },
      }),
      inject: [ConfigService],
    }),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get<string>('REDIS_HOST', 'localhost'),
        port: configService.get<number>('REDIS_PORT', 6379),
        password: configService.get<string>('REDIS_PASSWORD'),
        db: configService.get<number>('REDIS_DB', 0),
        ttl: configService.get<number>('REDIS_TTL', 3600),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [SessionController],
  providers: [
    SessionRepository,
    SessionService,
    RedisSessionService,
    DeviceParserService,
    SessionCleanupJob,
  ],
  exports: [SessionService, SessionRepository],
})
export class SessionModule {}
