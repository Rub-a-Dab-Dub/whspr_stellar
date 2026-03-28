import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddressBookModule } from '../address-book/address-book.module';
import { Conversation } from '../conversations/entities/conversation.entity';
import { ConversationParticipant } from '../conversations/entities/conversation-participant.entity';
import { Message } from '../messages/entities/message.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { UsersModule } from '../users/users.module';
import { InChatTransfersController } from './in-chat-transfers.controller';
import { InChatTransfersService } from './in-chat-transfers.service';
import { InChatTransfer } from './entities/in-chat-transfer.entity';
import { SorobanTransfersService } from './soroban-transfers.service';
import { TransfersGateway } from './transfers.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Conversation,
      ConversationParticipant,
      Message,
      Transaction,
      InChatTransfer,
      Wallet,
    ]),
    UsersModule,
    AddressBookModule,
  ],
  controllers: [InChatTransfersController],
  providers: [InChatTransfersService, SorobanTransfersService, TransfersGateway],
  exports: [InChatTransfersService],
})
export class InChatTransfersModule {}
