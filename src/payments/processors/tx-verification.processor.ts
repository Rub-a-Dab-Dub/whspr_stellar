import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TxVerificationService, ExpectedTxParams, TxVerificationStatus } from '../services/tx-verification.service';
import { Payment, PaymentStatus } from '../entities/payment.entity';

interface TxVerificationJob {
  paymentId: string;
  txHash: string;
  expectedParams: ExpectedTxParams;
}

@Processor('tx-verification')
export class TxVerificationProcessor {
  private readonly logger = new Logger(TxVerificationProcessor.name);
  private readonly TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

  constructor(
    private readonly txVerificationService: TxVerificationService,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  @Process('verify')
  async handleVerification(job: Job<TxVerificationJob>) {
    const { paymentId, txHash, expectedParams } = job.data;
    
    // Timeout Check (AC: Timeout after 10 minutes: mark as FAILED)
    const timeElapsed = Date.now() - job.timestamp;
    if (timeElapsed > this.TIMEOUT_MS) {
      this.logger.error(`Job for tx ${txHash} timed out after 10 minutes.`);
      await this.updatePaymentStatus(paymentId, PaymentStatus.FAILED, 'Timeout after 10 minutes');
      return;
    }

    this.logger.log(`Verifying tx ${txHash} (Attempt ${job.attemptsMade + 1})`);

    // Execute Verification
    const status = await this.txVerificationService.verify(txHash, expectedParams);

    // Handle Statuses
    if (status === TxVerificationStatus.VERIFIED) {
      await this.updatePaymentStatus(paymentId, PaymentStatus.VERIFIED);
      this.logger.log(`Payment ${paymentId} fully verified.`);
    } else if (status === TxVerificationStatus.FAILED) {
      await this.updatePaymentStatus(paymentId, PaymentStatus.FAILED, 'On-chain verification failed or reverted');
    } else if (status === TxVerificationStatus.PENDING) {
      // Throwing an error forces Bull to retry via exponential backoff
      throw new Error(`Transaction ${txHash} still pending or requires more confirmations. Retrying...`);
    }
  }

  private async updatePaymentStatus(paymentId: string, status: PaymentStatus, reason?: string) {
    await this.paymentRepository.update(paymentId, {
      status,
      ...(reason && { failureReason: reason }),
      ...(status === PaymentStatus.VERIFIED && { completedAt: new Date() })
    });
  }
}