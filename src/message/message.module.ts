import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { Message } from './entities/message.entity';
import { MessageEditHistory } from './entities/message-edit-history.entity';
import { MessageOwnershipGuard } from './guards/message-ownership.guard';
import {
  MessageRepository,
  MessageEditHistoryRepository,
} from './repositories/message.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Message, MessageEditHistory])],
  providers: [
    MessageService,
    MessageOwnershipGuard,
    MessageRepository,
    MessageEditHistoryRepository,
  ],
  controllers: [MessageController],
  exports: [MessageService, MessageRepository, MessageEditHistoryRepository],
})
export class MessageModule {}
