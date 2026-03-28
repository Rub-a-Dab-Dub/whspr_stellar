import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagingModule } from '../messaging/messaging.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Wallet } from '../wallets/entities/wallet.entity';
import { ReceiptController } from './controllers/receipt.controller';
import { TransactionsController } from './controllers/transactions.controller';
import { Transaction } from './entities/transaction.entity';
import { TransactionsRepository } from './repositories/transactions.repository';
import { ReceiptPdfGenerator } from './services/receipt-pdf.generator';
import { ReceiptService } from './services/receipt.service';
import { SorobanTransactionsService } from './services/soroban-transactions.service';
import { TransactionsService } from './services/transactions.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Transaction, Wallet]),
    MessagingModule,
    NotificationsModule,
  ],
  controllers: [TransactionsController, ReceiptController],
  providers: [
    TransactionsRepository,
    SorobanTransactionsService,
    TransactionsService,
    ReceiptPdfGenerator,
    ReceiptService,
  ],
  exports: [TransactionsService],
})
export class TransactionsModule {}
