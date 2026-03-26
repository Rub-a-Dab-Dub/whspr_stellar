import { Injectable } from '@nestjs/common';
import { HorizonClient } from '../transport/horizon.client';
import { RedisCache } from '../util/redis-cache';
import { FeeEstimateResponseDto } from '../dto/fee-estimate-response.dto';

type Tier = 'free'|'silver'|'gold'|'platinum';

@Injectable()
export class FeeEstimationService {
  // platform fee in basis points (e.g., 50 = 0.5%)
  platformBasisPoints = 50;

  tierDiscounts: Record<Tier, number> = {
    free: 0,
    silver: 10,
    gold: 25,
    platinum: 50
  };

  constructor(private horizon: HorizonClient, private cache: RedisCache) {}

  async getBaseFee(): Promise<number> {
    const cacheKey = 'horizon:base_fee';
    const cached = await this.cache.get<number>(cacheKey);
    if (cached) return cached;

    const stats = await this.horizon.getFeeStats();
    const base = Number(stats.base_fee) || 100; // stroops
    await this.cache.set(cacheKey, base);
    return base;
  }

  private async networkFeeForOp(opType: string, amount: number): Promise<number> {
    // simplified: network fee = base_fee * opMultiplier
    const base = await this.getBaseFee();
    let ops = 1;
    if (opType === 'split') ops = 2;
    if (opType === 'treasury') ops = 3;
    // amount does not affect network fee on Stellar directly, but we keep signature
    return base * ops; // in stroops (1 stroop = 0.0000001 XLM)
  }

  private applyTierDiscount(platformFee: number, tier?: Tier) {
    const discount = tier ? (this.tierDiscounts[tier] ?? 0) : 0;
    return platformFee * (1 - discount / 100);
  }

  private platformFeeFromNetwork(networkFee: number): number {
    return Math.ceil((networkFee * this.platformBasisPoints) / 10000);
  }

  async estimateTransferFee(amount: number, userTier?: Tier): Promise<FeeEstimateResponseDto> {
    return this.estimate('transfer', amount, userTier);
  }

  async estimateTipFee(amount: number, userTier?: Tier): Promise<FeeEstimateResponseDto> {
    return this.estimate('tip', amount, userTier);
  }

  async estimateSplitFee(amount: number, userTier?: Tier): Promise<FeeEstimateResponseDto> {
    return this.estimate('split', amount, userTier);
  }

  async estimateTreasuryFee(amount: number, userTier?: Tier): Promise<FeeEstimateResponseDto> {
    return this.estimate('treasury', amount, userTier);
  }

  private async estimate(op: string, amount: number, userTier?: Tier): Promise<FeeEstimateResponseDto> {
    const key = `fee:${op}:${amount}:${userTier ?? 'none'}`;
    const cached = await this.cache.get<FeeEstimateResponseDto>(key);
    if (cached) return cached;

    const network = await this.networkFeeForOp(op, amount);
    const platformRaw = this.platformFeeFromNetwork(network);
    const platform = Math.max(0, Math.round(this.applyTierDiscount(platformRaw, userTier)));
    const total = network + platform;

    const res: FeeEstimateResponseDto = { total, breakdown: { networkFee: network, platformFee: platform } };
    await this.cache.set(key, res);
    return res;
  }
}
