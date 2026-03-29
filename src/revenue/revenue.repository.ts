import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RevenueRecord } from './entities/revenue-record.entity';
import { FeeDistribution } from './entities/fee-distribution.entity';
import { RevenueSummaryDto, RevenueBySourceDto } from './dto/revenue-summary.dto';
import { RevenueSourceType } from './revenue.types';

@Injectable()
export class RevenueRepository {
  constructor(
    @InjectRepository(RevenueRecord)
    private revenueRecordRepo: Repository<RevenueRecord>,
    @InjectRepository(FeeDistribution)
    private feeDistributionRepo: Repository<FeeDistribution>,
  ) {}

  async createRevenueRecord(record: Partial<RevenueRecord>): Promise<RevenueRecord> {
    const entity = this.revenueRecordRepo.create(record);
    return this.revenueRecordRepo.save(entity);
  }

  async getRevenueSummary(period?: string): Promise<RevenueSummaryDto> {
    const where: any = {};
    if (period) where.period = period;

    const [records, total] = await this.revenueRecordRepo.findAndCount({
      where,
      select: ['sourceType', 'tokenId', 'amount', 'usdValue'],
    });

    const bySource = records.reduce((acc, r) => {
      const key = `${r.sourceType}_${r.tokenId}`;
      if (!acc[key]) {
        acc[key] = { sourceType: r.sourceType, tokenId: r.tokenId, totalAmount: '0', totalUsd: 0 };
      }
      acc[key].totalAmount = (BigInt(acc[key].totalAmount) + BigInt(r.amount)).toString();
      acc[key].totalUsd += r.usdValue;
      return acc;
    }, {} as Record<string, RevenueBySourceDto>);

    return {
      period: period || new Date().toISOString().slice(0, 10),
      bySource: Object.values(bySource),
      totalCollectedUsd: records.reduce((sum, r) => sum + r.usdValue, 0),
      totalRecords: total,
    };
  }

  async getUndistributedRevenue(period: string): Promise<{ totalAmount: string; totalUsd: number }> {
    const summary = await this.getRevenueSummary(period);
    // Check if distributed for period
    const distributed = await this.feeDistributionRepo.findOne({ where: { period } });
    if (distributed) return { totalAmount: '0', totalUsd: 0 };

    return {
      totalAmount: summary.bySource.reduce((sum, s) => (BigInt(sum) + BigInt(s.totalAmount)).toString(), '0'),
      totalUsd: summary.totalCollectedUsd,
    };
  }

  async createDistribution(dist: Partial<FeeDistribution>): Promise<FeeDistribution> {
    const entity = this.feeDistributionRepo.create(dist);
    return this.feeDistributionRepo.save(entity);
  }

  async getDistributionHistory(limit = 10): Promise<FeeDistribution[]> {
    return this.feeDistributionRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}

