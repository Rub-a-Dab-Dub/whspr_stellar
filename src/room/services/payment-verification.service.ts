import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

@Injectable()
export class PaymentVerificationService {
  private readonly logger = new Logger(PaymentVerificationService.name);
  private provider: ethers.JsonRpcProvider;
  private ggpayContract: ethers.Contract;

  constructor(private configService: ConfigService) {
    const rpcUrl = this.configService.get<string>('EVM_RPC_URL');
    const contractAddress = this.configService.get<string>('GGPAY_CONTRACT_ADDRESS');
    
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // GGPay ABI - adjust based on your contract
    const abi = [
      'event PaymentProcessed(address indexed payer, address indexed recipient, uint256 amount, uint256 platformFee, string roomId)',
      'function processPayment(address recipient, string memory roomId) external payable',
      'function platformFeePercentage() external view returns (uint256)'
    ];
    
    this.ggpayContract = new ethers.Contract(contractAddress, abi, this.provider);
  }

  async verifyTransaction(
    transactionHash: string,
    expectedAmount: string,
    roomId: string,
    userAddress: string
  ): Promise<{
    verified: boolean;
    amount: string;
    platformFee: string;
    creatorAmount: string;
    blockNumber: number;
  }> {
    try {
      // Get transaction receipt
      const receipt = await this.provider.getTransactionReceipt(transactionHash);
      
      if (!receipt) {
        throw new BadRequestException('Transaction not found or not confirmed');
      }

      if (receipt.status !== 1) {
        throw new BadRequestException('Transaction failed on blockchain');
      }

      // Parse logs to find PaymentProcessed event
      const iface = new ethers.Interface(this.ggpayContract.interface.fragments);
      let paymentEvent = null;

      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({
            topics: log.topics as string[],
            data: log.data
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
      const { payer, amount, platformFee, roomId: eventRoomId } = paymentEvent.args;

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
      if (Math.abs(actualAmountNum - expectedAmountNum) > expectedAmountNum * 0.001) {
        throw new BadRequestException('Payment amount mismatch');
      }

      const platformFeeInEther = ethers.formatEther(platformFee);
      const creatorAmount = (actualAmountNum - parseFloat(platformFeeInEther)).toString();

      return {
        verified: true,
        amount: amountInEther,
        platformFee: platformFeeInEther,
        creatorAmount,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      this.logger.error(`Transaction verification failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getTransactionStatus(transactionHash: string): Promise<{
    confirmed: boolean;
    confirmations: number;
    status?: number;
  }> {
    try {
      const receipt = await this.provider.getTransactionReceipt(transactionHash);
      
      if (!receipt) {
        return { confirmed: false, confirmations: 0 };
      }

      const currentBlock = await this.provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber + 1;

      return {
        confirmed: true,
        confirmations,
        status: receipt.status
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
      creatorAmount
    };
  }
}
