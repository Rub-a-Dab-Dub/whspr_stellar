import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransferController } from './transfer.controller';
import { TransferService } from './transfer.service';
import { Transfer } from './entities/transfer.entity';
import { BulkTransfer } from './entities/bulk-transfer.entity';
import { TransferValidationService } from './services/transfer-validation.service';
import { TransferBalanceService } from './services/transfer-balance.service';
import { TransferBlockchainService } from './services/transfer-blockchain.service';
import { TransferNotificationService } from './services/transfer-notification.service';
import { TransferReceiptService } from './services/transfer-receipt.service';
import { TransferAnalyticsService } from './services/transfer-analytics.service';
import { UsersModule } from '../user/user.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transfer, BulkTransfer]),
    UsersModule,
    QueueModule,
  ],
  controllers: [TransferController],
  providers: [
    TransferService,
    TransferValidationService,
    TransferBalanceService,
    TransferBlockchainService,
    TransferNotificationService,
    TransferReceiptService,
    TransferAnalyticsService,
  ],
  exports: [TransferService, TransferAnalyticsService],
})
export class TransferModule {}
