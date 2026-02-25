import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

export interface ExpectedTxParams {
  from: string;
  to: string;
  value: string;
  tokenAddress?: string | null;
  methodSig?: string;
  network?: string; // e.g., 'base', 'bnb', 'celo'
}

export enum TxVerificationStatus {
  VERIFIED = 'VERIFIED',
  FAILED = 'FAILED',
  PENDING = 'PENDING',
}

@Injectable()
export class TxVerificationService {
  private readonly logger = new Logger(TxVerificationService.name);

  constructor(private configService: ConfigService) {}

  async verify(txHash: string, expected: ExpectedTxParams): Promise<TxVerificationStatus> {
    try {
      const rpcUrl = this.configService.get<string>('EVM_RPC_URL');
      if (!rpcUrl) {
        throw new Error('EVM_RPC_URL is not defined in environment variables');
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);

      // Fetch Transaction & Receipt
      const tx = await provider.getTransaction(txHash);
      const receipt = await provider.getTransactionReceipt(txHash);

      // If either is null, it's still pending or dropped
      if (!tx || !receipt) {
        return TxVerificationStatus.PENDING;
      }

      // Check Reverted Transactions (status 0)
      if (receipt.status === 0) {
        this.logger.warn(`Transaction ${txHash} reverted on-chain.`);
        return TxVerificationStatus.FAILED;
      }

      // Confirmations Check (Chain Reorg protection)
      const currentBlock = await provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber + 1;
      
      const requiredConfirmations = expected.network === 'base' ? 2 : 3;
      
      if (confirmations < requiredConfirmations) {
        this.logger.log(`Tx ${txHash} has ${confirmations}/${requiredConfirmations} confirmations.`);
        return TxVerificationStatus.PENDING; // Re-verify later
      }

      // Verify Parameters
      if (tx.from.toLowerCase() !== expected.from.toLowerCase()) {
        this.logger.error(`Sender mismatch for ${txHash}`);
        return TxVerificationStatus.FAILED;
      }

      // If it's a native transfer, 'to' should match exactly. 
      // If it's a contract call (like GGPay), 'to' is the contract address.
      if (expected.tokenAddress || expected.methodSig) {
        if (expected.tokenAddress && tx.to?.toLowerCase() !== expected.tokenAddress.toLowerCase()) {
          this.logger.error(`Token/Contract address mismatch for ${txHash}`);
          return TxVerificationStatus.FAILED;
        }
        
        // Basic method signature check (first 4 bytes of data)
        if (expected.methodSig && !tx.data.startsWith(expected.methodSig)) {
          this.logger.error(`Method signature mismatch for ${txHash}`);
          return TxVerificationStatus.FAILED;
        }
      } else {
        if (tx.to?.toLowerCase() !== expected.to.toLowerCase()) {
          this.logger.error(`Recipient mismatch for ${txHash}`);
          return TxVerificationStatus.FAILED;
        }
      }

      // Value match check
      if (tx.value.toString() !== expected.value) {
         // Note: For ERC20 transfers, value is checked differently via logs, 
         // but we keep this strict for native token transfers based on AC.
         if (!expected.tokenAddress) {
            this.logger.error(`Value mismatch for ${txHash}`);
            return TxVerificationStatus.FAILED;
         }
      }

      return TxVerificationStatus.VERIFIED;
    } catch (error) {
      this.logger.error(`Error verifying transaction ${txHash}: ${error.message}`);
      // RPC failures throw an error, which the processor will catch and retry
      throw error; 
    }
  }
}