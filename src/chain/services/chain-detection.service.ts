import { Injectable, Logger } from '@nestjs/common';
import { SupportedChain } from '../enums/supported-chain.enum';
import { ChainService } from '../chain.service';

@Injectable()
export class ChainDetectionService {
  private readonly logger = new Logger(ChainDetectionService.name);

  constructor(private chainService: ChainService) {}

  /**
   * Detect which chain a transaction belongs to by querying each chain's provider.
   * Returns the first chain where the transaction is found.
   */
  async detectChainFromTransaction(
    transactionHash: string,
  ): Promise<SupportedChain | null> {
    const chains = this.chainService.getAllChains();

    const results = await Promise.allSettled(
      chains.map(async ({ chain }) => {
        const provider = this.chainService.getProvider(chain);
        const receipt = await provider.getTransactionReceipt(transactionHash);
        if (receipt) {
          return chain;
        }
        return null;
      }),
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        this.logger.log(
          `Detected chain ${result.value} for transaction ${transactionHash}`,
        );
        return result.value;
      }
    }

    this.logger.warn(
      `Could not detect chain for transaction ${transactionHash}`,
    );
    return null;
  }

  /**
   * Detect chain from a chain ID reported by the client wallet.
   */
  detectChainFromWalletChainId(chainId: number): SupportedChain | null {
    try {
      return this.chainService.getChainByChainId(chainId);
    } catch {
      this.logger.warn(`Unknown wallet chain ID: ${chainId}`);
      return null;
    }
  }

  /**
   * Validate that a transaction exists on the expected chain.
   */
  async validateTransactionChain(
    transactionHash: string,
    expectedChain: SupportedChain,
  ): Promise<boolean> {
    try {
      const provider = this.chainService.getProvider(expectedChain);
      const receipt = await provider.getTransactionReceipt(transactionHash);
      return receipt !== null;
    } catch (error) {
      this.logger.error(
        `Failed to validate transaction on ${expectedChain}: ${error.message}`,
      );
      return false;
    }
  }
}
