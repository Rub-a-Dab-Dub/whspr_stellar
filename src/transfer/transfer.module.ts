import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransferController } from './transfer.controller';
import { TransferService } from './transfer.service';
import { Transfer } from './entities/transfer.entity';
import { BulkTransfer } from './entities/bulk-transfer.entity';
import { TransferTemplate } from './entities/transfer-template.entity';
import { ScheduledTransfer } from './entities/scheduled-transfer.entity';
import { TransferLimit } from './entities/transfer-limit.entity';
import { TransferDispute } from './entities/transfer-dispute.entity';
import { TransferValidationService } from './services/transfer-validation.service';
import { TransferBalanceService } from './services/transfer-balance.service';
import { TransferBlockchainService } from './services/transfer-blockchain.service';
import { TransferNotificationService } from './services/transfer-notification.service';
import { TransferReceiptService } from './services/transfer-receipt.service';
import { TransferAnalyticsService } from './services/transfer-analytics.service';
import { TransferTemplateService } from './services/transfer-template.service';
import { TransferLimitService } from './services/transfer-limit.service';
import { ScheduledTransferService } from './services/scheduled-transfer.service';
import { TransferDisputeService } from './services/transfer-dispute.service';
import { UsersModule } from '../user/user.module';
import { QueueModule } from '../queue/queue.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transfer,
      BulkTransfer,
      TransferTemplate,
      ScheduledTransfer,
      TransferLimit,
      TransferDispute,
    ]),
    UsersModule,
    QueueModule,
    AdminModule,
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
    TransferTemplateService,
    TransferLimitService,
    ScheduledTransferService,
    TransferDisputeService,
  ],
  exports: [TransferService, TransferAnalyticsService, TransferLimitService],
})
export class TransferModule {}
