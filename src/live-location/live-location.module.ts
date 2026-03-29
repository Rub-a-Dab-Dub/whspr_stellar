import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from '../conversations/entities/conversation.entity';
import { ConversationParticipant } from '../conversations/entities/conversation-participant.entity';
import { MessagingModule } from '../messaging/messaging.module';
import { User } from '../users/entities/user.entity';
import { LocationShare } from './entities/location-share.entity';
import { LocationShareExpiryJob } from './location-share-expiry.job';
import { LocationShareController } from './location-share.controller';
import { LocationShareService } from './location-share.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LocationShare, Conversation, ConversationParticipant, User]),
    MessagingModule,
  ],
  controllers: [LocationShareController],
  providers: [LocationShareService, LocationShareExpiryJob],
  exports: [LocationShareService],
})
export class LiveLocationModule {}
