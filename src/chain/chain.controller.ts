import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ChainService } from './chain.service';
import { ChainMonitoringService } from './services/chain-monitoring.service';
import { ChainAnalyticsService } from './services/chain-analytics.service';
import { ChainDetectionService } from './services/chain-detection.service';
import { SelectChainDto } from './dto/select-chain.dto';
import { UpdateChainPreferenceDto } from './dto/update-chain-preference.dto';
import { SupportedChain } from './enums/supported-chain.enum';

@Controller('chains')
export class ChainController {
  constructor(
    private chainService: ChainService,
    private chainMonitoringService: ChainMonitoringService,
    private chainAnalyticsService: ChainAnalyticsService,
    private chainDetectionService: ChainDetectionService,
  ) {}

  /**
   * Get all supported chains and their configurations.
   */
  @Public()
  @Get()
  getSupportedChains() {
    const chains = this.chainService.getAllChains();
    return chains.map(({ chain, config }) => ({
      id: chain,
      name: config.name,
      chainId: config.chainId,
      currency: config.currency,
      explorerUrl: config.explorerUrl,
      isTestnet: config.isTestnet,
    }));
  }

  /**
   * Get the status of all chains (health, latency, latest block).
   */
  @Public()
  @Get('status')
  getAllChainStatuses() {
    return this.chainMonitoringService.getAllChainStatuses();
  }

  /**
   * Get the status of a specific chain.
   */
  @Public()
  @Get(':chain/status')
  async getChainStatus(@Param('chain') chain: string) {
    const validChain = this.chainService.validateChain(chain);
    return this.chainMonitoringService.checkChainHealth(validChain);
  }

  /**
   * Validate and select a chain for a transaction.
   */
  @Post('select')
  async selectChain(@Body() selectChainDto: SelectChainDto) {
    const config = this.chainService.getChainConfig(selectChainDto.chain);
    const isHealthy = this.chainMonitoringService.isChainHealthy(
      selectChainDto.chain,
    );

    return {
      chain: selectChainDto.chain,
      name: config.name,
      chainId: config.chainId,
      contractAddress: config.contractAddress,
      rpcUrl: config.rpcUrl,
      isHealthy,
    };
  }

  /**
   * Detect which chain a transaction belongs to.
   */
  @Get('detect/:transactionHash')
  async detectChain(@Param('transactionHash') transactionHash: string) {
    const chain =
      await this.chainDetectionService.detectChainFromTransaction(
        transactionHash,
      );

    if (!chain) {
      return { detected: false, chain: null };
    }

    const config = this.chainService.getChainConfig(chain);
    return {
      detected: true,
      chain,
      name: config.name,
      chainId: config.chainId,
    };
  }

  /**
   * Get cross-chain payment analytics.
   */
  @Get('analytics')
  async getAnalytics() {
    return this.chainAnalyticsService.getPaymentStatsByChain();
  }

  /**
   * Get analytics for a specific chain.
   */
  @Get(':chain/analytics')
  async getChainAnalytics(@Param('chain') chain: string) {
    const validChain = this.chainService.validateChain(chain);
    return this.chainAnalyticsService.getStatsForChain(validChain);
  }

  /**
   * Get cross-chain volume over time.
   */
  @Get('analytics/volume')
  async getCrossChainVolume(@Query('days') days?: number) {
    return this.chainAnalyticsService.getCrossChainVolume(days || 30);
  }
}
