import { Processor, Process } from '@nestjs/bull';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import type { Job } from 'bull';
import { QUEUE_NAMES } from '../queue.constants';
import { WalletService } from '../../wallets/services/wallet.service';

@Processor(QUEUE_NAMES.WALLET_CREATION)
export class WalletCreationProcessor {
  private readonly logger = new Logger(WalletCreationProcessor.name);

  constructor(
    @Inject(forwardRef(() => WalletService))
    private readonly walletService: WalletService,
  ) {}

  @Process()
  async handleWalletCreation(job: Job) {
    this.logger.log(`Processing wallet creation job ${job.id}`);
    const { userId } = job.data;

    try {
      await job.progress(30);
      const wallet = await this.walletService.generateWallet(userId);
      
      await job.progress(100);
      this.logger.log(`Wallet ${wallet.address} created for user ${userId}`);

      return { success: true, walletId: wallet.id, address: wallet.address };
    } catch (error) {
      this.logger.error(`Wallet creation job ${job.id} failed:`, error);
      throw error;
    }
  }
}
