import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { MessageMedia } from './entities/message-media.entity';
import { User } from '../user/entities/user.entity';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { IpfsService } from './services/ipfs.service';
import { NoOpMediaScanService } from './services/no-op-media-scan.service';
import { ContractMessageService } from './services/contract-message.service';
import { MEDIA_SCAN_SERVICE } from './services/media-scan.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MessageMedia, User]),
    JwtModule.register({}),
    ConfigModule,
  ],
  controllers: [MessagesController],
  providers: [
    MessagesService,
    IpfsService,
    ContractMessageService,
    {
      provide: MEDIA_SCAN_SERVICE,
      useClass: NoOpMediaScanService,
    },
  ],
  exports: [MessagesService],
})
export class MessagesModule {}
