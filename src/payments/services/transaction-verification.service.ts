import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface VerifiedTransaction {
    hash: string;
    from: string;
    to: string;
    amount: string;
    tokenAddress: string | null;
    contractId: string | null;
}

@Injectable()
export class TransactionVerificationService {
    private readonly logger = new Logger(TransactionVerificationService.name);
    private readonly contractId: string | null;

    constructor(private readonly configService: ConfigService) {
        this.contractId = this.configService.get('SOROBAN_CONTRACT_ID') ?? null;
    }

    async verifyTransaction(txHash: string): Promise<VerifiedTransaction> {
        // Simplified verification - in production, you would:
        // 1. Query Stellar Horizon or Soroban RPC to get transaction details
        // 2. Parse the transaction envelope to extract amounts and addresses
        // 3. Verify the transaction was successful

        // For now, we'll do basic validation and trust the frontend
        if (!txHash || txHash.length !== 64) {
            throw new BadRequestException('Invalid transaction hash format');
        }

        this.logger.log(`Verifying transaction: ${txHash}`);

        // Return a basic verified transaction structure
        // In production, parse actual blockchain data
        return {
            hash: txHash,
            from: '',
            to: '',
            amount: '',
            tokenAddress: null,
            contractId: this.contractId,
        };
    }

    verifyContractMatch(verifiedTx: VerifiedTransaction): boolean {
        if (!this.contractId) {
            return true; // Skip verification if no contract configured
        }
        return verifiedTx.contractId === this.contractId;
    }

    verifyAmounts(
        verifiedAmount: string,
        expectedAmount: number,
        platformFeePercent: number = 2,
    ): { isValid: boolean; recipientAmount: string; platformFee: string } {
        // Calculate expected amounts with platform fee
        const platformFee = expectedAmount * (platformFeePercent / 100);
        const recipientAmount = expectedAmount - platformFee;

        // For now, assume valid since we're trusting the frontend
        // In production, compare verifiedAmount from blockchain with expectedAmount
        const isValid = true;

        return {
            isValid,
            recipientAmount: recipientAmount.toFixed(8),
            platformFee: platformFee.toFixed(8),
        };
    }
}
