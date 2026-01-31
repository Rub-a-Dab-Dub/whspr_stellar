import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Transfer, TransferStatus, TransferType } from './entities/transfer.entity';
import { BulkTransfer, BulkTransferStatus } from './entities/bulk-transfer.entity';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { CreateBulkTransferDto } from './dto/create-bulk-transfer.dto';
import { TransferQueryDto } from './dto/transfer-query.dto';
import { TransferValidationService } from './services/transfer-validation.service';
import { TransferBalanceService } from './services/transfer-balance.service';
import { TransferBlockchainService } from './services/transfer-blockchain.service';
import { TransferNotificationService } from './services/transfer-notification.service';
import { UsersService } from '../user/user.service';
import { AuditLogService } from '../admin/services/audit-log.service';
import {
  AuditAction,
  AuditEventType,
  AuditOutcome,
  AuditSeverity,
} from '../admin/entities/audit-log.entity';

@Injectable()
export class TransferService {
  private readonly logger = new Logger(TransferService.name);

  constructor(
    @InjectRepository(Transfer)
    private readonly transferRepository: Repository<Transfer>,
    @InjectRepository(BulkTransfer)
    private readonly bulkTransferRepository: Repository<BulkTransfer>,
    private readonly validationService: TransferValidationService,
    private readonly balanceService: TransferBalanceService,
    private readonly blockchainService: TransferBlockchainService,
    private readonly notificationService: TransferNotificationService,
    private readonly usersService: UsersService,
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createTransfer(
    senderId: string,
    createTransferDto: CreateTransferDto,
  ): Promise<Transfer> {
    const { recipientId, amount, memo, note, blockchainNetwork = 'stellar' } = createTransferDto;

    // Validate amount
    this.validationService.validateAmount(amount);

    // Validate recipient
    await this.validationService.validateRecipient(recipientId, senderId);

    // Validate balance
    await this.validationService.validateBalance(senderId, amount, blockchainNetwork);

    // Record balance snapshots
    const senderBalanceBefore = await this.balanceService.recordBalanceSnapshot(
      senderId,
      blockchainNetwork,
    );
    const recipientBalanceBefore = await this.balanceService.recordBalanceSnapshot(
      recipientId,
      blockchainNetwork,
    );

    // Create transfer record
    const transfer = this.transferRepository.create({
      senderId,
      recipientId,
      amount: amount.toFixed(8),
      memo,
      note,
      blockchainNetwork,
      type: TransferType.P2P,
      status: TransferStatus.PENDING,
      senderBalanceBefore,
      recipientBalanceBefore,
    });

    await this.transferRepository.save(transfer);

    await this.safeAuditLog({
      actorUserId: senderId,
      targetUserId: recipientId,
      action: AuditAction.TRANSFER_CREATED,
      eventType: AuditEventType.TRANSACTION,
      outcome: AuditOutcome.SUCCESS,
      severity: AuditSeverity.MEDIUM,
      resourceType: 'transfer',
      resourceId: transfer.id,
      details: 'Transfer created',
      metadata: {
        amount: transfer.amount,
        memo,
        note,
        blockchainNetwork,
      },
    });

    // Execute blockchain transfer asynchronously
    this.executeTransferAsync(transfer.id);

    return transfer;
  }

  private async executeTransferAsync(transferId: string): Promise<void> {
    try {
      const transfer = await this.transferRepository.findOne({
        where: { id: transferId },
        relations: ['sender', 'recipient'],
      });

      if (!transfer) {
        this.logger.error(`Transfer ${transferId} not found`);
        return;
      }

      // Update status to processing
      transfer.status = TransferStatus.PROCESSING;
      await this.transferRepository.save(transfer);

      // Get wallet addresses
      const senderPublicKey = await this.blockchainService.getUserPublicKey(transfer.senderId);
      const recipientPublicKey = await this.blockchainService.getUserPublicKey(transfer.recipientId);

      if (!senderPublicKey || !recipientPublicKey) {
        throw new Error('Wallet addresses not found');
      }

      // Execute blockchain transfer
      const result = await this.blockchainService.executeTransfer(
        senderPublicKey,
        recipientPublicKey,
        transfer.amount,
        transfer.memo,
      );

      if (result.success) {
        // Record balance snapshots after transfer
        const senderBalanceAfter = await this.balanceService.recordBalanceSnapshot(
          transfer.senderId,
          transfer.blockchainNetwork,
        );
        const recipientBalanceAfter = await this.balanceService.recordBalanceSnapshot(
          transfer.recipientId,
          transfer.blockchainNetwork,
        );

        transfer.status = TransferStatus.COMPLETED;
        transfer.transactionHash = result.transactionHash;
        transfer.senderBalanceAfter = senderBalanceAfter;
        transfer.recipientBalanceAfter = recipientBalanceAfter;
        transfer.completedAt = new Date();

        await this.transferRepository.save(transfer);

        await this.safeAuditLog({
          actorUserId: transfer.senderId,
          targetUserId: transfer.recipientId,
          action: AuditAction.TRANSFER_COMPLETED,
          eventType: AuditEventType.TRANSACTION,
          outcome: AuditOutcome.SUCCESS,
          severity: AuditSeverity.MEDIUM,
          resourceType: 'transfer',
          resourceId: transfer.id,
          details: 'Transfer completed',
          metadata: {
            transactionHash: transfer.transactionHash,
            amount: transfer.amount,
            blockchainNetwork: transfer.blockchainNetwork,
          },
        });

        // Send notifications
        await this.notificationService.notifyTransferSent(transfer, transfer.recipient.email);
        await this.notificationService.notifyTransferReceived(transfer, transfer.sender.email);

        this.logger.log(`Transfer ${transferId} completed successfully`);
      } else {
        throw new Error(result.error || 'Transfer failed');
      }
    } catch (error) {
      this.logger.error(`Transfer ${transferId} failed: ${error.message}`);
      await this.handleTransferFailure(transferId, error.message);
    }
  }

  private async handleTransferFailure(transferId: string, reason: string): Promise<void> {
    const transfer = await this.transferRepository.findOne({
      where: { id: transferId },
    });

    if (!transfer) {
      return;
    }

    transfer.status = TransferStatus.FAILED;
    transfer.failureReason = reason;
    transfer.failedAt = new Date();
    transfer.retryCount += 1;

    await this.transferRepository.save(transfer);
    await this.safeAuditLog({
      actorUserId: transfer.senderId,
      targetUserId: transfer.recipientId,
      action: AuditAction.TRANSFER_FAILED,
      eventType: AuditEventType.TRANSACTION,
      outcome: AuditOutcome.FAILURE,
      severity: AuditSeverity.HIGH,
      resourceType: 'transfer',
      resourceId: transfer.id,
      details: 'Transfer failed',
      metadata: {
        reason,
        amount: transfer.amount,
        blockchainNetwork: transfer.blockchainNetwork,
      },
    });
    await this.notificationService.notifyTransferFailed(transfer, reason);
  }

  private async safeAuditLog(
    input: Parameters<AuditLogService['createAuditLog']>[0],
  ) {
    try {
      await this.auditLogService.createAuditLog(input);
    } catch (error) {
      this.logger.warn(`Failed to write transfer audit log: ${error.message}`);
    }
  }

  async createBulkTransfer(
    senderId: string,
    createBulkTransferDto: CreateBulkTransferDto,
  ): Promise<BulkTransfer> {
    const { recipients, memo, blockchainNetwork = 'stellar' } = createBulkTransferDto;

    // Validate bulk transfer
    await this.validationService.validateBulkTransfer(
      senderId,
      recipients,
      blockchainNetwork,
    );

    const totalAmount = recipients.reduce((sum, r) => sum + r.amount, 0);

    // Create bulk transfer record
    const bulkTransfer = this.bulkTransferRepository.create({
      senderId,
      totalRecipients: recipients.length,
      totalAmount: totalAmount.toFixed(8),
      memo,
      blockchainNetwork,
      status: BulkTransferStatus.PENDING,
    });

    await this.bulkTransferRepository.save(bulkTransfer);

    // Create individual transfer records
    const transfers = recipients.map(recipient =>
      this.transferRepository.create({
        senderId,
        recipientId: recipient.recipientId,
        amount: recipient.amount.toFixed(8),
        note: recipient.note,
        memo,
        blockchainNetwork,
        type: TransferType.BULK,
        bulkTransferId: bulkTransfer.id,
        status: TransferStatus.PENDING,
      }),
    );

    await this.transferRepository.save(transfers);

    // Execute bulk transfer asynchronously
    this.executeBulkTransferAsync(bulkTransfer.id);

    return bulkTransfer;
  }

  private async executeBulkTransferAsync(bulkTransferId: string): Promise<void> {
    const bulkTransfer = await this.bulkTransferRepository.findOne({
      where: { id: bulkTransferId },
    });

    if (!bulkTransfer) {
      return;
    }

    bulkTransfer.status = BulkTransferStatus.PROCESSING;
    await this.bulkTransferRepository.save(bulkTransfer);

    const transfers = await this.transferRepository.find({
      where: { bulkTransferId },
    });

    let successful = 0;
    let failed = 0;

    for (const transfer of transfers) {
      try {
        await this.executeTransferAsync(transfer.id);
        successful++;
      } catch (error) {
        failed++;
        this.logger.error(`Bulk transfer item ${transfer.id} failed: ${error.message}`);
      }
    }

    bulkTransfer.successfulTransfers = successful;
    bulkTransfer.failedTransfers = failed;
    bulkTransfer.status = 
      failed === 0 
        ? BulkTransferStatus.COMPLETED 
        : successful === 0 
        ? BulkTransferStatus.FAILED 
        : BulkTransferStatus.PARTIALLY_COMPLETED;
    bulkTransfer.completedAt = new Date();

    await this.bulkTransferRepository.save(bulkTransfer);
    await this.notificationService.notifyBulkTransferComplete(
      bulkTransfer.senderId,
      bulkTransfer.id,
      successful,
      failed,
    );
  }

  async getTransferHistory(
    userId: string,
    query: TransferQueryDto,
  ): Promise<{ transfers: Transfer[]; total: number }> {
    const { status, type, recipientId, senderId, limit = 20, offset = 0 } = query;

    const queryBuilder = this.transferRepository
      .createQueryBuilder('transfer')
      .leftJoinAndSelect('transfer.sender', 'sender')
      .leftJoinAndSelect('transfer.recipient', 'recipient')
      .where('(transfer.senderId = :userId OR transfer.recipientId = :userId)', { userId });

    if (status) {
      queryBuilder.andWhere('transfer.status = :status', { status });
    }

    if (type) {
      queryBuilder.andWhere('transfer.type = :type', { type });
    }

    if (recipientId) {
      queryBuilder.andWhere('transfer.recipientId = :recipientId', { recipientId });
    }

    if (senderId) {
      queryBuilder.andWhere('transfer.senderId = :senderId', { senderId });
    }

    queryBuilder
      .orderBy('transfer.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    const [transfers, total] = await queryBuilder.getManyAndCount();

    return { transfers, total };
  }

  async getTransferById(transferId: string, userId: string): Promise<Transfer> {
    const transfer = await this.transferRepository.findOne({
      where: { id: transferId },
      relations: ['sender', 'recipient'],
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    if (transfer.senderId !== userId && transfer.recipientId !== userId) {
      throw new NotFoundException('Transfer not found');
    }

    return transfer;
  }

  async getBulkTransferById(bulkTransferId: string, userId: string): Promise<BulkTransfer> {
    const bulkTransfer = await this.bulkTransferRepository.findOne({
      where: { id: bulkTransferId, senderId: userId },
    });

    if (!bulkTransfer) {
      throw new NotFoundException('Bulk transfer not found');
    }

    return bulkTransfer;
  }

  async getBulkTransferItems(bulkTransferId: string, userId: string): Promise<Transfer[]> {
    const bulkTransfer = await this.getBulkTransferById(bulkTransferId, userId);

    return this.transferRepository.find({
      where: { bulkTransferId: bulkTransfer.id },
      relations: ['recipient'],
      order: { createdAt: 'ASC' },
    });
  }
}
