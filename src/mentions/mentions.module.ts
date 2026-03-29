import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mention } from './entities/mention.entity';
import { MentionsController } from './controllers/mentions.controller';
import { MentionsService } from './services/mentions.service';
import { MentionsRepository } from './repositories/mentions.repository';
import { MentionsGateway } from './gateway/mentions.gateway';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Mention]), NotificationsModule],
  controllers: [MentionsController],
  providers: [MentionsService, MentionsRepository, MentionsGateway],
  exports: [MentionsService],
})
export class MentionsModule {}
