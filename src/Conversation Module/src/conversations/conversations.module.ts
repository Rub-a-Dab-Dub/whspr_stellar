import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { ConversationParticipant } from './entities/conversation-participant.entity';
import { Message } from './entities/message.entity';
import { ConversationsService } from './services/conversations.service';
import { ConversationsController } from './controllers/conversations.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, ConversationParticipant, Message])],
  controllers: [ConversationsController],
  providers: [ConversationsService],
})
export class ConversationsModule {}
