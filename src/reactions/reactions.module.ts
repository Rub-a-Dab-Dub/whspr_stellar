import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from '../Conversation Module/src/conversations/entities/message.entity';
import { MessagingModule } from '../messaging/messaging.module';
import { Reaction } from './entities/reaction.entity';
import { ReactionsController } from './reactions.controller';
import { ReactionsRepository } from './reactions.repository';
import { ReactionsService } from './reactions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Reaction, Message]), MessagingModule],
  controllers: [ReactionsController],
  providers: [ReactionsRepository, ReactionsService],
  exports: [ReactionsService],
})
export class ReactionsModule {}
