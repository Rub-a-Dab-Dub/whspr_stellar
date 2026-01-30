import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { TransferLimit, LimitPeriod } from '../entities/transfer-limit.entity';

@Injectable()
export class TransferLimitService {
  private readonly logger = new Logger(TransferLimitService.name);

  constructor(
    @InjectRepository(TransferLimit)
    private readonly limitRepository: Repository<TransferLimit>,
  ) {}

  async checkLimit(
    userId: string,
    amount: number,
    period: LimitPeriod = LimitPeriod.DAILY,
  ): Promise<{ allowed: boolean; remaining: number; limit: number }> {
    const limit = await this.getActiveLimit(userId, period);

    if (!limit) {
      return { allowed: true, remaining: Infinity, limit: Infinity };
    }

    const limitAmount = parseFloat(limit.limitAmount);
    const usedAmount = parseFloat(limit.usedAmount);
    const remaining = limitAmount - usedAmount;

    if (amount > remaining) {
      return { allowed: false, remaining, limit: limitAmount };
    }

    // Check transaction count limit
    if (limit.maxTransactionCount) {
      if (limit.transactionCount >= limit.maxTransactionCount) {
        return { allowed: false, remaining, limit: limitAmount };
      }
    }

    return { allowed: true, remaining, limit: limitAmount };
  }

  async validateLimit(
    userId: string,
    amount: number,
    period: LimitPeriod = LimitPeriod.DAILY,
  ): Promise<void> {
    const check = await this.checkLimit(userId, amount, period);

    if (!check.allowed) {
      throw new BadRequestException(
        `Transfer exceeds ${period} limit. Remaining: ${check.remaining}, Limit: ${check.limit}`,
      );
    }
  }

  async recordTransfer(
    userId: string,
    amount: number,
    period: LimitPeriod = LimitPeriod.DAILY,
  ): Promise<void> {
    const limit = await this.getActiveLimit(userId, period);

    if (limit) {
      const newUsedAmount = parseFloat(limit.usedAmount) + amount;
      limit.usedAmount = newUsedAmount.toFixed(8);
      limit.transactionCount += 1;
      await this.limitRepository.save(limit);
    }
  }

  async setLimit(
    userId: string,
    period: LimitPeriod,
    limitAmount: number,
    maxTransactionCount?: number,
  ): Promise<TransferLimit> {
    const { periodStart, periodEnd } = this.calculatePeriod(period);

    // Deactivate existing limits for this period
    await this.limitRepository.update(
      { userId, period, isActive: true },
      { isActive: false },
    );

    const limit = this.limitRepository.create({
      userId,
      period,
      limitAmount: limitAmount.toFixed(8),
      usedAmount: '0',
      transactionCount: 0,
      maxTransactionCount,
      periodStart,
      periodEnd,
      isActive: true,
    });

    return await this.limitRepository.save(limit);
  }

  async getActiveLimit(
    userId: string,
    period: LimitPeriod,
  ): Promise<TransferLimit | null> {
    const now = new Date();

    // Find active limit for current period
    let limit = await this.limitRepository.findOne({
      where: {
        userId,
        period,
        isActive: true,
      },
    });

    // If limit exists but period has expired, reset it
    if (limit && limit.periodEnd < now) {
      const { periodStart, periodEnd } = this.calculatePeriod(period);
      limit.usedAmount = '0';
      limit.transactionCount = 0;
      limit.periodStart = periodStart;
      limit.periodEnd = periodEnd;
      limit = await this.limitRepository.save(limit);
    }

    return limit;
  }

  async getLimits(userId: string): Promise<TransferLimit[]> {
    return await this.limitRepository.find({
      where: { userId, isActive: true },
      order: { period: 'ASC' },
    });
  }

  async removeLimit(userId: string, period: LimitPeriod): Promise<void> {
    await this.limitRepository.update(
      { userId, period, isActive: true },
      { isActive: false },
    );
  }

  private calculatePeriod(period: LimitPeriod): { periodStart: Date; periodEnd: Date } {
    const now = new Date();
    const periodStart = new Date(now);
    const periodEnd = new Date(now);

    switch (period) {
      case LimitPeriod.DAILY:
        periodStart.setHours(0, 0, 0, 0);
        periodEnd.setHours(23, 59, 59, 999);
        break;
      case LimitPeriod.WEEKLY:
        const dayOfWeek = now.getDay();
        periodStart.setDate(now.getDate() - dayOfWeek);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd.setDate(periodStart.getDate() + 6);
        periodEnd.setHours(23, 59, 59, 999);
        break;
      case LimitPeriod.MONTHLY:
        periodStart.setDate(1);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd.setMonth(periodStart.getMonth() + 1);
        periodEnd.setDate(0);
        periodEnd.setHours(23, 59, 59, 999);
        break;
    }

    return { periodStart, periodEnd };
  }

  async cleanupExpiredLimits(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    await this.limitRepository.delete({
      isActive: false,
      updatedAt: LessThan(thirtyDaysAgo),
    });

    this.logger.log('Cleaned up expired transfer limits');
  }
}
