import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WithdrawalRequest } from './entities/withdrawal-request.entity';
import { WithdrawalAuditLog } from './entities/withdrawal-audit-log.entity';
import { WithdrawalsService } from './withdrawals.service';
import { RiskScoringService } from './services/risk-scoring.service';
import { AuditLogService } from './services/audit-log.service';
import { NotificationService } from './services/notification.service';
import { BlockchainQueueService } from './services/blockchain-queue.service';
import { AdminWithdrawalsController } from './admin-withdrawals.controller';
import { WithdrawalsController } from './withdrawals.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WithdrawalRequest, WithdrawalAuditLog])],
  controllers: [AdminWithdrawalsController, WithdrawalsController],
  providers: [
    WithdrawalsService,
    RiskScoringService,
    AuditLogService,
    NotificationService,
    BlockchainQueueService,
  ],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
