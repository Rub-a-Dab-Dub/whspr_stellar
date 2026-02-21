import { Injectable, Logger } from '@nestjs/common';
import { WithdrawalRequest } from '../entities/withdrawal-request.entity';

@Injectable()
export class BlockchainQueueService {
  private readonly logger = new Logger(BlockchainQueueService.name);

  /**
   * Queues an approved withdrawal for on-chain processing.
   * In production, push to a job queue (Bull/BullMQ, RabbitMQ, SQS, etc.)
   * with retry logic and a dedicated blockchain worker.
   */
  async enqueue(withdrawal: WithdrawalRequest): Promise<{ jobId: string }> {
    const jobId = `withdraw-${withdrawal.id}-${Date.now()}`;

    this.logger.log(
      `[BLOCKCHAIN QUEUE] Enqueued jobId=${jobId} ` +
        `withdrawalId=${withdrawal.id} amount=${withdrawal.amount} ${withdrawal.chain} ` +
        `to=${withdrawal.walletAddress}`,
    );

    // Example with BullMQ:
    // await this.withdrawalQueue.add('process-withdrawal', {
    //   withdrawalId: withdrawal.id,
    //   walletAddress: withdrawal.walletAddress,
    //   amount: withdrawal.amount,
    //   chain: withdrawal.chain,
    // }, {
    //   attempts: 5,
    //   backoff: { type: 'exponential', delay: 2000 },
    //   removeOnComplete: false,
    // });

    return { jobId };
  }
}
