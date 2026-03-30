import { Module } from '@nestjs/common';
import { BlockEnforcementModule } from '../../block-enforcement/block-enforcement.module';
import { ConversationsModule } from '../../Conversation Module/src/conversations/conversations.module';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { MessagesRepository } from './messages.repository';
import { MessagesGateway } from './messages.gateway';
import { SorobanService } from './soroban.service';

@Module({
  imports: [BlockEnforcementModule, ConversationsModule],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesRepository, MessagesGateway, SorobanService],
  exports: [MessagesService],
})
export class MessagesModule {}
