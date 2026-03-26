import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from '../conversations/entities/conversation.entity';
import { ConversationParticipant } from '../conversations/entities/conversation-participant.entity';
import { Message } from '../messages/entities/message.entity';
import { MessagingModule } from '../messaging/messaging.module';
import { SorobanModule } from '../soroban/soroban.module';
import { UsersModule } from '../users/users.module';
import { PinnedMessage } from './entities/pinned-message.entity';
import { PinnedMessagesController } from './pinned-messages.controller';
import { PinnedMessagesRepository } from './pinned-messages.repository';
import { PinnedMessagesService } from './pinned-messages.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PinnedMessage,
      Conversation,
      ConversationParticipant,
      Message,
    ]),
    MessagingModule,
    SorobanModule,
    UsersModule,
  ],
  controllers: [PinnedMessagesController],
  providers: [PinnedMessagesService, PinnedMessagesRepository],
})
export class PinnedMessagesModule {}
