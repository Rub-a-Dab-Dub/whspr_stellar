import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';

export interface TransferResult {
  transactionHash: string;
  success: boolean;
  error?: string;
}

@Injectable()
export class TransferBlockchainService {
  private readonly logger = new Logger(TransferBlockchainService.name);
  private server: StellarSdk.Horizon.Server;
  private networkPassphrase: string;

  constructor(private readonly configService: ConfigService) {
    const horizonUrl = this.configService.get<string>('STELLAR_HORIZON_URL') || 
      'https://horizon-testnet.stellar.org';
    this.server = new StellarSdk.Horizon.Server(horizonUrl);
    this.networkPassphrase = this.configService.get<string>('STELLAR_NETWORK_PASSPHRASE') ||
      StellarSdk.Networks.TESTNET;
  }

  async executeTransfer(
    senderPublicKey: string,
    recipientPublicKey: string,
    amount: string,
    memo?: string,
  ): Promise<TransferResult> {
    try {
      // Load sender account
      const senderAccount = await this.server.loadAccount(senderPublicKey);

      // Build transaction
      const transaction = new StellarSdk.TransactionBuilder(senderAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: recipientPublicKey,
            asset: StellarSdk.Asset.native(),
            amount: amount,
          }),
        )
        .setTimeout(180);

      // Add memo if provided
      if (memo) {
        transaction.addMemo(StellarSdk.Memo.text(memo));
      }

      const builtTransaction = transaction.build();

      // In production, this would be signed by the user's private key
      // For gasless transactions, this would be handled by the relayer
      // For now, this is a placeholder that returns the XDR
      
      return {
        transactionHash: builtTransaction.hash().toString('hex'),
        success: true,
      };
    } catch (error) {
      this.logger.error(`Transfer execution failed: ${error.message}`);
      return {
        transactionHash: '',
        success: false,
        error: error.message,
      };
    }
  }

  async submitSignedTransaction(xdr: string): Promise<TransferResult> {
    try {
      const transaction = new StellarSdk.Transaction(xdr, this.networkPassphrase);
      const result = await this.server.submitTransaction(transaction);

      return {
        transactionHash: result.hash,
        success: result.successful,
      };
    } catch (error) {
      this.logger.error(`Transaction submission failed: ${error.message}`);
      return {
        transactionHash: '',
        success: false,
        error: error.message,
      };
    }
  }

  async verifyTransaction(transactionHash: string): Promise<boolean> {
    try {
      const transaction = await this.server.transactions()
        .transaction(transactionHash)
        .call();
      
      return transaction.successful;
    } catch (error) {
      this.logger.error(`Transaction verification failed: ${error.message}`);
      return false;
    }
  }

  async getUserPublicKey(userId: string): Promise<string | null> {
    // TODO: Implement database lookup for user's Stellar public key
    // This should query the user's wallet entity
    return null;
  }
}
