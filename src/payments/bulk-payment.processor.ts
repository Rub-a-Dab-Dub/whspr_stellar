import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { BulkPaymentsRepository } from './bulk-payments.repository';
import { BulkPayment } from './entities/bulk-payment.entity';
import { BulkPaymentStatus, BulkPaymentRowStatus } from './enums';
import { InChatTransfersService } from '../../in-chat-transfers/in-chat-transfers.service'; // assume this is TransfersService
import { MailService } from '../../mail/mail.service';

interface ProcessBulkPaymentData {
  bulkPaymentId: string;
}

@Processor('bulk-payments')
@Injectable()
export class BulkPaymentProcessor {
  private readonly logger = new Logger(BulkPaymentProcessor.name);

  constructor(
    private readonly repo: BulkPaymentsRepository,
    private readonly transfersService: InChatTransfersService,
    private readonly mailService: MailService,
  ) {}

  @Process('process-bulk-payment')
  async handleProcessBulkPayment(job: Job<ProcessBulkPaymentData>) {
    const { bulkPaymentId } = job.data;
    this.logger.log(`Starting bulk payment processing: ${bulkPaymentId}`);

    const bulkPayment = await this.repo.findById(bulkPaymentId);
    if (!bulkPayment) {
      this.logger.error(`Bulk payment not found: ${bulkPaymentId}`);
      return;
    }

    // Mark processing
    await this.repo.updateStatus(bulkPaymentId, BulkPaymentStatus.PROCESSING);

    let success = 0;
    let failure = 0;

    // Sequential row processing
    while (true) {
      const pendingRows = await this.repo.getPendingRowsForProcessing(bulkPaymentId);
      if (pendingRows.length === 0) break;

      const row = pendingRows[0];
      try {
        // Create transfer via existing service
        const txResult = await this.transfersService.confirmTransfer({ // or createTransfer
          userId: bulkPayment.initiatedById,
          recipientUsername: row.toUsername,
          amount: row.amountUsdc,
          note: `Bulk payment ${bulkPayment.label} row ${row.rowNumber}`,
          asset: 'USDC',
        });

        // Update row success
        await this.repo.updateRowStatus(row.id, BulkPaymentRowStatus.SUCCESS, { txId: txResult.txId });
        success++;
      } catch (error) {
        // Update row failed
        await this.repo.updateRowStatus(row.id, BulkPaymentRowStatus.FAILED, { 
          failureReason: error.message 
        });
        failure++;
      }

      // Update bulk counts
      await this.repo.updateCounts(bulkPaymentId, success, failure);
    }

    // Final status & email
    const finalStatus = failure === 0 ? BulkPaymentStatus.COMPLETED : BulkPaymentStatus.PARTIAL_FAILURE;
    await this.repo.updateStatus(bulkPaymentId, finalStatus, new Date());

    // Summary email
    await this.mailService.sendBulkPaymentSummary(
      bulkPayment.initiatedBy.email!,
      {
        totalRows: bulkPayment.totalRows,
        success,
        failure,
        label: bulkPayment.label,
      },
    );

    this.logger.log(`Bulk payment ${bulkPaymentId} completed: ${success}/${bulkPayment.totalRows}`);
  }
}

