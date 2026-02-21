import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WithdrawalRequest, WithdrawalStatus } from '../entities/withdrawal-request.entity';

export interface RiskAssessment {
  score: number; // 0-100, higher = riskier
  isNewAddress: boolean;
  flags: string[];
}

@Injectable()
export class RiskScoringService {
  private readonly logger = new Logger(RiskScoringService.name);

  constructor(
    @InjectRepository(WithdrawalRequest)
    private readonly withdrawalRepo: Repository<WithdrawalRequest>,
  ) {}

  async assessRisk(
    userId: string,
    walletAddress: string,
    amount: number,
    chain: string,
  ): Promise<RiskAssessment> {
    const flags: string[] = [];
    let score = 0;

    // Check if this is a new wallet address for the user
    const previousWithdrawals = await this.withdrawalRepo.count({
      where: {
        userId,
        walletAddress,
        status: WithdrawalStatus.COMPLETED,
      },
    });

    const isNewAddress = previousWithdrawals === 0;
    if (isNewAddress) {
      score += 30;
      flags.push('NEW_WALLET_ADDRESS');
    }

    // Large amount threshold check
    const largeAmountThreshold = parseFloat(
      process.env.LARGE_AMOUNT_RISK_THRESHOLD || '10000',
    );
    if (amount >= largeAmountThreshold) {
      score += 25;
      flags.push('LARGE_AMOUNT');
    }

    // Check withdrawal frequency in last 24h
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentWithdrawals = await this.withdrawalRepo.count({
      where: {
        userId,
        requestedAt: last24h as any,
      },
    });

    if (recentWithdrawals >= 3) {
      score += 20;
      flags.push('HIGH_FREQUENCY_WITHDRAWALS');
    }

    // Check for round numbers (often associated with fraud)
    if (amount % 1000 === 0 && amount >= 5000) {
      score += 10;
      flags.push('ROUND_NUMBER_AMOUNT');
    }

    // Check total daily withdrawal volume
    const dailyTotal = await this.withdrawalRepo
      .createQueryBuilder('wr')
      .select('SUM(wr.amount)', 'total')
      .where('wr.userId = :userId', { userId })
      .andWhere('wr.requestedAt >= :since', { since: last24h })
      .andWhere('wr.status NOT IN (:...statuses)', {
        statuses: [WithdrawalStatus.REJECTED],
      })
      .getRawOne();

    const dailyTotalAmount = parseFloat(dailyTotal?.total || '0');
    const dailyLimit = parseFloat(process.env.DAILY_WITHDRAWAL_LIMIT || '50000');
    if (dailyTotalAmount + amount > dailyLimit) {
      score += 15;
      flags.push('DAILY_LIMIT_EXCEEDED');
    }

    this.logger.log(
      `Risk assessment for user ${userId}: score=${score}, flags=${flags.join(',')}`,
    );

    return {
      score: Math.min(score, 100),
      isNewAddress,
      flags,
    };
  }
}
