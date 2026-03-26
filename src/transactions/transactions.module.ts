import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagingModule } from '../messaging/messaging.module';
import { Wallet } from '../wallets/entities/wallet.entity';
import { TransactionsController } from './controllers/transactions.controller';
import { Transaction } from './entities/transaction.entity';
import { TransactionsRepository } from './repositories/transactions.repository';
import { SorobanTransactionsService } from './services/soroban-transactions.service';
import { TransactionsService } from './services/transactions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, Wallet]), MessagingModule],
  controllers: [TransactionsController],
  providers: [TransactionsRepository, SorobanTransactionsService, TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
