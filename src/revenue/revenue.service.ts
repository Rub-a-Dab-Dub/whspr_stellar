import { Injectable, Logger } from '@nestjs/common';
import { RevenueRepository } from './revenue.repository';
import { RevenueRecord } from './entities/revenue-record.entity';
import { FeeDistribution } from './entities/fee-distribution.entity';
import { DistributeRevenueDto } from './dto/distribute-revenue.dto';
import { RevenueSummaryDto } from './dto/revenue-summary.dto';
import { RevenueSourceType, StakeholderDistribution } from './revenue.types';
import { TreasuryContractService } from '../soroban/services/treasury-contract/treasury-contract.service';

@Injectable()
export class RevenueService {
  private readonly logger = new Logger(RevenueService.name);
  private readonly defaultSplits = {
    treasury: 0.6,
    referralPool: 0.2,
    stakingRewards: 0.2,
  };

  constructor(
    private readonly repo: RevenueRepository,
    private readonly treasuryService: TreasuryContractService,
  ) {}

  async recordRevenue(
    sourceType: RevenueSourceType,
    sourceId: string,
    amount: string,
    tokenId: string,
    usdValue: number,
  ): Promise<RevenueRecord> {
    const period = new Date().toISOString().slice(0, 10);
    const record: Partial<RevenueRecord> = {
      sourceType,
      sourceId,
      amount,
      tokenId,
      usdValue,
      period,
    };
    return this.repo.createRevenueRecord(record);
  }

  async getRevenueSummary(period?: string): Promise<RevenueSummaryDto> {
    return this.repo.getRevenueSummary(period);
  }

  async getRevenueBySource(sourceType?: RevenueSourceType, tokenId?: string, period?: string): Promise<RevenueSummaryDto> {
    return this.repo.getRevenueSummary(period); // filter in repo later
  }

  async computeDistribution(period: string): Promise<{ total: string; distributions: StakeholderDistribution[] }> {
    const undistr = await this.repo.getUndistributedRevenue(period);
    if (parseFloat(undistr.totalUsd) === 0) {
      throw new Error(`No undistributed revenue for period ${period}`);
    }

    const distributions: StakeholderDistribution[] = Object.entries(this.defaultSplits).map(([stakeholder, ratio]) => ({
      stakeholder,
      share: (parseFloat(undistr.totalAmount) * ratio).toString(),
      tokenId: 'XLM', // assume native for now
    }));

    return { total: undistr.totalAmount, distributions };
  }

  async executeDistribution(dto: DistributeRevenueDto): Promise<string> {
    const { period, splits = this.defaultSplits } = dto;
    const comp = await this.computeDistribution(period);

    const txHashes: string[] = [];
    for (const dist of comp.distributions) {
      // Use treasury contract to withdraw to stakeholder
      const txHash = await this.treasuryService.withdraw(dist.stakeholder, parseFloat(dist.share));
      txHashes.push(txHash);
    }

    // Create distribution record
    const distribution: Partial<FeeDistribution> = {
      period,
      totalCollected: comp.total,
      platformShare: comp.total, // before dist
      stakeholderDistributions: comp.distributions,
      distributedAt: new Date(),
      txHash: txHashes.join(','),
    };
    await this.repo.createDistribution(distribution);

    this.logger.log(`Distribution executed for ${period}: ${txHashes.length} txs`);
    return txHashes[0]; // main tx
  }

  async getDistributionHistory(): Promise<FeeDistribution[]> {
    return this.repo.getDistributionHistory();
  }
}

