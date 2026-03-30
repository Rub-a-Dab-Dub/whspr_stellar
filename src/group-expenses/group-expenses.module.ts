import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from '../conversations/entities/conversation.entity';
import { ConversationParticipant } from '../conversations/entities/conversation-participant.entity';
import { InChatTransfersModule } from '../in-chat-transfers/in-chat-transfers.module';
import { MessagingModule } from '../messaging/messaging.module';
import { UsersModule } from '../users/users.module';
import { ExpenseSplit } from './entities/expense-split.entity';
import { GroupExpense } from './entities/group-expense.entity';
import { GroupExpensesController } from './group-expenses.controller';
import { GroupExpensesService } from './group-expenses.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([GroupExpense, ExpenseSplit, Conversation, ConversationParticipant]),
    UsersModule,
    InChatTransfersModule,
    MessagingModule,
  ],
  controllers: [GroupExpensesController],
  providers: [GroupExpensesService],
  exports: [GroupExpensesService],
})
export class GroupExpensesModule {}
