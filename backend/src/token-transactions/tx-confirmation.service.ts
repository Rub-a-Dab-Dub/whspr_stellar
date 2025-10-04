import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { TransactionsService } from './token-transactions.service';

@Injectable()
export class TxConfirmationWorker {
  private logger = new Logger(TxConfirmationWorker.name);
  private provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  constructor(private txService: TransactionsService) {}

  // call periodically (e.g. @Cron every 30s) or use queue
  async pollPending() {
    const pending = await this.txService.findPendingTransactions();


    for (const tx of pending) {
      if (!tx.txHash) continue;
      try {
        const receipt = await this.provider.getTransactionReceipt(tx.txHash);
        if (
          receipt &&
          receipt.confirmations &&
          receipt.confirmations > (Number(process.env.MIN_CONFIRMATIONS) || 2)
        ) {
          await this.txService.acceptOnChainTx(tx.txHash, receipt);
        } else if (receipt && receipt.status === 0) {
          tx.status = 'FAILED';
          await this.txService.txRepo.save(tx);
        }
      } catch (err) {
        this.logger.error('Error while polling tx', err);
      }
    }
  }
}
