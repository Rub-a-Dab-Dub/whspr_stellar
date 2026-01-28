import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupportedChain } from '../enums/supported-chain.enum';
import { ChainService } from '../chain.service';

export interface ChainStatus {
  chain: SupportedChain;
  name: string;
  chainId: number;
  isHealthy: boolean;
  latestBlock: number | null;
  latency: number | null; // milliseconds
  lastCheckedAt: Date;
}

@Injectable()
export class ChainMonitoringService {
  private readonly logger = new Logger(ChainMonitoringService.name);
  private chainStatuses: Map<SupportedChain, ChainStatus> = new Map();

  constructor(private chainService: ChainService) {}

  /**
   * Periodically check the health of all chain RPC endpoints.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkAllChains(): Promise<void> {
    const chains = this.chainService.getAllChains();

    await Promise.allSettled(
      chains.map(({ chain }) => this.checkChainHealth(chain)),
    );
  }

  /**
   * Check the health of a single chain's RPC endpoint.
   */
  async checkChainHealth(chain: SupportedChain): Promise<ChainStatus> {
    const config = this.chainService.getChainConfig(chain);
    const startTime = Date.now();

    try {
      const provider = this.chainService.getProvider(chain);
      const blockNumber = await provider.getBlockNumber();
      const latency = Date.now() - startTime;

      const status: ChainStatus = {
        chain,
        name: config.name,
        chainId: config.chainId,
        isHealthy: true,
        latestBlock: blockNumber,
        latency,
        lastCheckedAt: new Date(),
      };

      this.chainStatuses.set(chain, status);
      return status;
    } catch (error) {
      this.logger.warn(
        `Chain ${config.name} health check failed: ${error.message}`,
      );

      const status: ChainStatus = {
        chain,
        name: config.name,
        chainId: config.chainId,
        isHealthy: false,
        latestBlock: null,
        latency: null,
        lastCheckedAt: new Date(),
      };

      this.chainStatuses.set(chain, status);
      return status;
    }
  }

  /**
   * Get the cached status of a specific chain.
   */
  getChainStatus(chain: SupportedChain): ChainStatus | null {
    return this.chainStatuses.get(chain) || null;
  }

  /**
   * Get the cached status of all chains.
   */
  getAllChainStatuses(): ChainStatus[] {
    return Array.from(this.chainStatuses.values());
  }

  /**
   * Check if a chain is currently healthy based on cached status.
   */
  isChainHealthy(chain: SupportedChain): boolean {
    const status = this.chainStatuses.get(chain);
    if (!status) {
      return false;
    }

    // Consider stale if last check was more than 10 minutes ago
    const staleThreshold = 10 * 60 * 1000;
    const isStale =
      Date.now() - status.lastCheckedAt.getTime() > staleThreshold;

    return status.isHealthy && !isStale;
  }
}
