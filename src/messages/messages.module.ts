import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AnalyticsModule } from '../analytics/analytics.module';
import { MessageMedia } from './entities/message-media.entity';
import { Message } from './entities/message.entity';
import { MessageEdit } from './entities/message-edit.entity';
import { RoomMember } from '../rooms/entities/room-member.entity';
import { User } from '../user/entities/user.entity';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { IpfsService } from './services/ipfs.service';
import { NoOpMediaScanService } from './services/no-op-media-scan.service';
import { ContractMessageService } from './services/contract-message.service';
import { MEDIA_SCAN_SERVICE } from './services/media-scan.service';
import { MessagesGateway } from './messages.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MessageMedia,
      User,
      Message,
      MessageEdit,
      RoomMember,
    ]),
    JwtModule.register({}),
    ConfigModule,
    EventEmitterModule.forRoot(),
    AnalyticsModule,
  ],
  controllers: [MessagesController],
  providers: [
    MessagesService,
    IpfsService,
    ContractMessageService,
    MessagesGateway,
    {
      provide: MEDIA_SCAN_SERVICE,
      useClass: NoOpMediaScanService,
    },
  ],
  exports: [MessagesService],
})
export class MessagesModule {}
