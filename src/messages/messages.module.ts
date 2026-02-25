import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MessageMedia } from './entities/message-media.entity';
import { Message } from './entities/message.entity';
import { MessageEdit } from './entities/message-edit.entity';
import { RoomMember } from '../rooms/entities/room-member.entity';
import { User } from '../user/entities/user.entity';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { MessagesGateway } from './messages.gateway';
import { IpfsService } from './services/ipfs.service';
import { NoOpMediaScanService } from './services/no-op-media-scan.service';
import { ContractMessageService } from './services/contract-message.service';
import { MEDIA_SCAN_SERVICE } from './services/media-scan.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { XpModule } from '../xp/xp.module';

/**
 * MessagesModule
 *
 * Wires:
 *  - Socket.IO gateway (/messages) with JWT auth
 *  - MessagesService (DB-first persist, XP awards, analytics)
 *  - XpModule for SEND_MESSAGE XP awards
 *
 * The circular dependency between MessagesGateway and MessagesService is
 * resolved at init time via gateway.setMessagesService().
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      MessageMedia,
      User,
      Message,
      MessageEdit,
      RoomMember,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET'),
      }),
    }),
    ConfigModule,
    EventEmitterModule.forRoot(),
    AnalyticsModule,
    XpModule,
  ],
  controllers: [MessagesController],
  providers: [
    MessagesService,
    MessagesGateway,
    IpfsService,
    ContractMessageService,
    {
      provide: MEDIA_SCAN_SERVICE,
      useClass: NoOpMediaScanService,
    },
  ],
  exports: [MessagesService],
})
export class MessagesModule implements OnModuleInit {
  constructor(
    private readonly gateway: MessagesGateway,
    private readonly service: MessagesService,
  ) {}

  /**
   * Wire the gateway → service reference after both are constructed.
   * This avoids a circular provider dependency.
   */
  onModuleInit() {
    this.gateway.setMessagesService(this.service);
  }
}
