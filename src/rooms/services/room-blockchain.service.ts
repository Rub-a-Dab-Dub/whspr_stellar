import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';

export interface TransactionVerification {
  isValid: boolean;
  amount?: string;
  recipient?: string;
  error?: string;
}

@Injectable()
export class RoomBlockchainService {
  private readonly logger = new Logger(RoomBlockchainService.name);
  private readonly server: StellarSdk.Horizon.Server;

  constructor(private readonly configService: ConfigService) {
    const horizonUrl = this.configService.get('STELLAR_HORIZON_URL') ?? 'https://horizon-testnet.stellar.org';
    this.server = new StellarSdk.Horizon.Server(horizonUrl);
  }

  async verifyTransaction(
    txHash: string,
    expectedAmount: string,
    expectedRecipient: string,
  ): Promise<TransactionVerification> {
    try {
      const transaction = await this.server.transactions().transaction(txHash).call();
      
      if (!transaction.successful) {
        return { isValid: false, error: 'Transaction failed' };
      }

      const operations = await this.server.operations().forTransaction(txHash).call();
      
      for (const op of operations.records) {
        if (op.type === 'payment') {
          const payment = op as any;
          if (
            payment.to === expectedRecipient &&
            payment.amount === expectedAmount &&
            payment.asset_type === 'native'
          ) {
            return {
              isValid: true,
              amount: payment.amount,
              recipient: payment.to,
            };
          }
        }
      }

      return { isValid: false, error: 'Payment not found or invalid' };
    } catch (error) {
      this.logger.error(`Transaction verification failed: ${error.message}`);
      return { isValid: false, error: error.message };
    }
  }

  async distributeFees(
    totalAmount: string,
    creatorWallet: string,
    treasuryWallet: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const total = parseFloat(totalAmount);
      const platformFee = (total * 0.02).toFixed(7);
      const creatorAmount = (total * 0.98).toFixed(7);

      // In a real implementation, you would execute these transfers
      this.logger.log(`Platform fee: ${platformFee} to ${treasuryWallet}`);
      this.logger.log(`Creator amount: ${creatorAmount} to ${creatorWallet}`);

      return { success: true };
    } catch (error) {
      this.logger.error(`Fee distribution failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}