import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { ChainService } from '../../chain/chain.service';
import { SupportedChain } from '../../chain/enums/supported-chain.enum';

@Injectable()
export class PaymentVerificationService {
  private readonly logger = new Logger(PaymentVerificationService.name);

  constructor(private chainService: ChainService) {}

  /**
   * Verify a payment transaction on the specified chain.
   */
  async verifyTransaction(
    transactionHash: string,
    expectedAmount: string,
    roomId: string,
    userAddress: string,
    chain: SupportedChain = SupportedChain.ETHEREUM,
  ): Promise<{
    verified: boolean;
    amount: string;
    platformFee: string;
    creatorAmount: string;
    blockNumber: number;
  }> {
    try {
      const provider = this.chainService.getProvider(chain);
      const contract = this.chainService.getContract(chain);

      // Get transaction receipt
      const receipt = await provider.getTransactionReceipt(transactionHash);

      if (!receipt) {
        throw new BadRequestException('Transaction not found or not confirmed');
      }

      if (receipt.status !== 1) {
        throw new BadRequestException('Transaction failed on blockchain');
      }

      // Validate the transaction is on the expected chain
      const chainConfig = this.chainService.getChainConfig(chain);
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== chainConfig.chainId) {
        throw new BadRequestException(
          `Chain ID mismatch: expected ${chainConfig.chainId}, got ${network.chainId}`,
        );
      }

      // Parse logs to find PaymentProcessed event
      const iface = new ethers.Interface(contract.interface.fragments);
      let paymentEvent = null;

      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });

          if (parsed && parsed.name === 'PaymentProcessed') {
            paymentEvent = parsed;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!paymentEvent) {
        throw new BadRequestException('Payment event not found in transaction');
      }

      // Verify payment details
      const {
        payer,
        amount,
        platformFee,
        roomId: eventRoomId,
      } = paymentEvent.args;

      if (payer.toLowerCase() !== userAddress.toLowerCase()) {
        throw new BadRequestException('Payer address mismatch');
      }

      if (eventRoomId !== roomId) {
        throw new BadRequestException('Room ID mismatch');
      }

      const amountInEther = ethers.formatEther(amount);
      const expectedAmountNum = parseFloat(expectedAmount);
      const actualAmountNum = parseFloat(amountInEther);

      // Allow 0.1% tolerance for floating point differences
      if (
        Math.abs(actualAmountNum - expectedAmountNum) >
        expectedAmountNum * 0.001
      ) {
        throw new BadRequestException('Payment amount mismatch');
      }

      const platformFeeInEther = ethers.formatEther(platformFee);
      const creatorAmount = (
        actualAmountNum - parseFloat(platformFeeInEther)
      ).toString();

      return {
        verified: true,
        amount: amountInEther,
        platformFee: platformFeeInEther,
        creatorAmount,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      this.logger.error(
        `Transaction verification failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get the status of a transaction on the specified chain.
   */
  async getTransactionStatus(
    transactionHash: string,
    chain: SupportedChain = SupportedChain.ETHEREUM,
  ): Promise<{
    confirmed: boolean;
    confirmations: number;
    status?: number;
  }> {
    try {
      const provider = this.chainService.getProvider(chain);
      const receipt = await provider.getTransactionReceipt(transactionHash);

      if (!receipt) {
        return { confirmed: false, confirmations: 0 };
      }

      const currentBlock = await provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber + 1;

      return {
        confirmed: true,
        confirmations,
        status: receipt.status,
      };
    } catch (error) {
      this.logger.error(`Failed to get transaction status: ${error.message}`);
      throw new BadRequestException('Failed to retrieve transaction status');
    }
  }

  calculateRevenueSplit(amount: string): {
    platformFee: string;
    creatorAmount: string;
  } {
    const amountNum = parseFloat(amount);
    const platformFee = (amountNum * 0.02).toFixed(8); // 2%
    const creatorAmount = (amountNum * 0.98).toFixed(8); // 98%

    return {
      platformFee,
      creatorAmount,
    };
  }
}
