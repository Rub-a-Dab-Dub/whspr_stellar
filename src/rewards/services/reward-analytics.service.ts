import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Reward } from '../entities/reward.entity';
import { UserReward } from '../entities/user-reward.entity';
import { RewardType } from '../enums/reward-type.enum';
import { UserRewardStatus } from '../enums/user-reward-status.enum';

@Injectable()
export class RewardAnalyticsService {
  constructor(
    @InjectRepository(Reward)
    private readonly rewardRepository: Repository<Reward>,
    @InjectRepository(UserReward)
    private readonly userRewardRepository: Repository<UserReward>,
  ) {}

  /**
   * Get total rewards granted
   */
  async getTotalRewardsGranted(): Promise<number> {
    return this.userRewardRepository.count();
  }

  /**
   * Get rewards granted by type
   */
  async getRewardsByType(): Promise<
    Array<{
      type: RewardType;
      count: number;
      active: number;
      redeemed: number;
      expired: number;
    }>
  > {
    const rewards = await this.rewardRepository.find();
    const results = [];

    for (const reward of rewards) {
      const [total, active, redeemed, expired] = await Promise.all([
        this.userRewardRepository.count({ where: { rewardId: reward.id } }),
        this.userRewardRepository.count({
          where: { rewardId: reward.id, status: UserRewardStatus.ACTIVE },
        }),
        this.userRewardRepository.count({
          where: { rewardId: reward.id, status: UserRewardStatus.REDEEMED },
        }),
        this.userRewardRepository.count({
          where: { rewardId: reward.id, status: UserRewardStatus.EXPIRED },
        }),
      ]);

      results.push({
        type: reward.type,
        count: total,
        active,
        redeemed,
        expired,
      });
    }

    return results;
  }

  /**
   * Get rewards granted in date range
   */
  async getRewardsInDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    total: number;
    byType: Array<{ type: RewardType; count: number }>;
    byStatus: Array<{ status: UserRewardStatus; count: number }>;
  }> {
    const [total, byTypeResults, byStatusResults] = await Promise.all([
      this.userRewardRepository.count({
        where: {
          createdAt: Between(startDate, endDate),
        },
      }),
      this.userRewardRepository
        .createQueryBuilder('ur')
        .innerJoin('ur.reward', 'reward')
        .select('reward.type', 'type')
        .addSelect('COUNT(*)', 'count')
        .where('ur.createdAt >= :startDate', { startDate })
        .andWhere('ur.createdAt <= :endDate', { endDate })
        .groupBy('reward.type')
        .getRawMany(),
      this.userRewardRepository
        .createQueryBuilder('ur')
        .select('ur.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('ur.createdAt >= :startDate', { startDate })
        .andWhere('ur.createdAt <= :endDate', { endDate })
        .groupBy('ur.status')
        .getRawMany(),
    ]);

    const byType = byTypeResults.map((row) => ({
      type: row.type as RewardType,
      count: parseInt(row.count || '0'),
    }));

    const byStatus = byStatusResults.map((row) => ({
      status: row.status as UserRewardStatus,
      count: parseInt(row.count || '0'),
    }));

    return {
      total,
      byType,
      byStatus,
    };
  }

  /**
   * Get top users by rewards received
   */
  async getTopUsersByRewards(limit: number = 10): Promise<
    Array<{
      userId: string;
      totalRewards: number;
      activeRewards: number;
      redeemedRewards: number;
    }>
  > {
    const results = await this.userRewardRepository
      .createQueryBuilder('ur')
      .select('ur.userId', 'userId')
      .addSelect('COUNT(*)', 'totalRewards')
      .addSelect(
        'SUM(CASE WHEN ur.status = :active THEN 1 ELSE 0 END)',
        'activeRewards',
      )
      .addSelect(
        'SUM(CASE WHEN ur.status = :redeemed THEN 1 ELSE 0 END)',
        'redeemedRewards',
      )
      .setParameter('active', UserRewardStatus.ACTIVE)
      .setParameter('redeemed', UserRewardStatus.REDEEMED)
      .groupBy('ur.userId')
      .orderBy('totalRewards', 'DESC')
      .limit(limit)
      .getRawMany();

    return results.map((row) => ({
      userId: row.userId,
      totalRewards: parseInt(row.totalRewards || '0'),
      activeRewards: parseInt(row.activeRewards || '0'),
      redeemedRewards: parseInt(row.redeemedRewards || '0'),
    }));
  }

  /**
   * Get reward redemption rate
   */
  async getRedemptionRate(): Promise<{
    totalGranted: number;
    totalRedeemed: number;
    redemptionRate: number;
  }> {
    const [totalGranted, totalRedeemed] = await Promise.all([
      this.userRewardRepository.count(),
      this.userRewardRepository.count({
        where: { status: UserRewardStatus.REDEEMED },
      }),
    ]);

    const redemptionRate =
      totalGranted > 0 ? (totalRedeemed / totalGranted) * 100 : 0;

    return {
      totalGranted,
      totalRedeemed,
      redemptionRate: Math.round(redemptionRate * 100) / 100,
    };
  }

  /**
   * Get rewards by event
   */
  async getRewardsByEvent(): Promise<
    Array<{
      eventName: string;
      count: number;
    }>
  > {
    const results = await this.userRewardRepository
      .createQueryBuilder('ur')
      .select('ur.eventName', 'eventName')
      .addSelect('COUNT(*)', 'count')
      .where('ur.eventName IS NOT NULL')
      .groupBy('ur.eventName')
      .orderBy('count', 'DESC')
      .getRawMany();

    return results.map((row) => ({
      eventName: row.eventName,
      count: parseInt(row.count || '0'),
    }));
  }

  /**
   * Get trading statistics
   */
  async getTradingStats(): Promise<{
    totalTrades: number;
    totalGifts: number;
    mostTradedReward: {
      rewardId: string;
      rewardName: string;
      tradeCount: number;
    } | null;
  }> {
    const [totalTrades, totalGifts, mostTraded] = await Promise.all([
      this.userRewardRepository.count({
        where: { status: UserRewardStatus.TRADED },
      }),
      this.userRewardRepository.count({
        where: { status: UserRewardStatus.GIFTED },
      }),
      this.userRewardRepository
        .createQueryBuilder('ur')
        .innerJoin('ur.reward', 'reward')
        .select('ur.rewardId', 'rewardId')
        .addSelect('reward.name', 'rewardName')
        .addSelect('COUNT(*)', 'tradeCount')
        .where('ur.status = :traded', { traded: UserRewardStatus.TRADED })
        .groupBy('ur.rewardId')
        .addGroupBy('reward.name')
        .orderBy('tradeCount', 'DESC')
        .limit(1)
        .getRawOne(),
    ]);

    return {
      totalTrades,
      totalGifts,
      mostTradedReward: mostTraded
        ? {
            rewardId: mostTraded.rewardId,
            rewardName: mostTraded.rewardName || 'Unknown',
            tradeCount: parseInt(mostTraded.tradeCount || '0'),
          }
        : null,
    };
  }
}
