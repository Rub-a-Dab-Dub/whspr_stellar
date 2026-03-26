import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { AuthModule } from '../auth/auth.module';

import { ChatGateway } from './gateways/chat.gateway';
import { NotificationsGateway } from './gateways/notifications.gateway';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { PresenceService } from './services/presence.service';
import { TypingService } from './services/typing.service';
import { EventReplayService } from './services/event-replay.service';

@Module({
  imports: [
    // Provides JwtService (via JwtModule re-export) and AuthService
    AuthModule,
  ],
  providers: [
    // Gateways
    ChatGateway,
    NotificationsGateway,

    // Guard (injected into gateways; also available for manual use)
    WsJwtGuard,

    // Services
    PresenceService,
    TypingService,
    EventReplayService,

    // Dedicated Redis connection for messaging (presence + event replay)
    {
      provide: 'REDIS_CLIENT',
      useFactory: (config: ConfigService): Redis => {
        const client = new Redis({
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          db: config.get<number>('REDIS_DB', 0),
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        });
        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: [
    // Allow other modules to push notifications / check presence
    ChatGateway,
    NotificationsGateway,
    PresenceService,
    EventReplayService,
  ],
})
export class MessagingModule {}
