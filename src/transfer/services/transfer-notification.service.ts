import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QUEUE_NAMES } from '../../queue/queue.constants';
import { Transfer } from '../entities/transfer.entity';

export interface TransferNotification {
  userId: string;
  type: 'transfer_sent' | 'transfer_received' | 'transfer_failed';
  transferId: string;
  amount: string;
  recipientName?: string;
  senderName?: string;
  transactionHash?: string;
}

@Injectable()
export class TransferNotificationService {
  private readonly logger = new Logger(TransferNotificationService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private notificationQueue: Queue,
  ) {}

  async notifyTransferSent(transfer: Transfer, recipientName: string): Promise<void> {
    try {
      await this.notificationQueue.add('transfer-notification', {
        userId: transfer.senderId,
        type: 'transfer_sent',
        transferId: transfer.id,
        amount: transfer.amount,
        recipientName,
        transactionHash: transfer.transactionHash,
      });

      this.logger.log(`Transfer sent notification queued for user ${transfer.senderId}`);
    } catch (error) {
      this.logger.error(`Failed to queue transfer sent notification: ${error.message}`);
    }
  }

  async notifyTransferReceived(transfer: Transfer, senderName: string): Promise<void> {
    try {
      await this.notificationQueue.add('transfer-notification', {
        userId: transfer.recipientId,
        type: 'transfer_received',
        transferId: transfer.id,
        amount: transfer.amount,
        senderName,
        transactionHash: transfer.transactionHash,
      });

      this.logger.log(`Transfer received notification queued for user ${transfer.recipientId}`);
    } catch (error) {
      this.logger.error(`Failed to queue transfer received notification: ${error.message}`);
    }
  }

  async notifyTransferFailed(transfer: Transfer, reason: string): Promise<void> {
    try {
      await this.notificationQueue.add('transfer-notification', {
        userId: transfer.senderId,
        type: 'transfer_failed',
        transferId: transfer.id,
        amount: transfer.amount,
        reason,
      });

      this.logger.log(`Transfer failed notification queued for user ${transfer.senderId}`);
    } catch (error) {
      this.logger.error(`Failed to queue transfer failed notification: ${error.message}`);
    }
  }

  async notifyBulkTransferComplete(
    senderId: string,
    bulkTransferId: string,
    successful: number,
    failed: number,
  ): Promise<void> {
    try {
      await this.notificationQueue.add('bulk-transfer-notification', {
        userId: senderId,
        bulkTransferId,
        successful,
        failed,
      });

      this.logger.log(`Bulk transfer notification queued for user ${senderId}`);
    } catch (error) {
      this.logger.error(`Failed to queue bulk transfer notification: ${error.message}`);
    }
  }
}
