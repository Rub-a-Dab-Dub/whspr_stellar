import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { randomBytes } from 'crypto';
import { ReferralsRepository } from '../repositories/referrals.repository';
import { UsersRepository } from '../../users/users.repository';
import { ReferralStatus } from '../entities/referral.entity';
import { UserTier } from '../../users/entities/user.entity';

@Injectable()
export class ReferralsService {
  constructor(
    private readonly referralsRepository: ReferralsRepository,
    private readonly usersRepository: UsersRepository,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async generateCode(userId: string): Promise<string> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.referralCode) {
      return user.referralCode;
    }

    let code = '';
    let isUnique = false;
    while (!isUnique) {
      code = randomBytes(4).toString('hex').toUpperCase();
      const existing = await this.usersRepository.findOne({ where: { referralCode: code } });
      if (!existing) {
        isUnique = true;
      }
    }

    user.referralCode = code;
    await this.usersRepository.save(user);
    return code;
  }

  async applyReferralCode(refereeId: string, code: string): Promise<void> {
    const referrer = await this.usersRepository.findOne({ where: { referralCode: code } });
    if (!referrer) {
      throw new BadRequestException('Invalid referral code');
    }
    if (referrer.id === refereeId) {
      throw new BadRequestException('Self-referral prevented');
    }

    const existingReferral = await this.referralsRepository.findByRefereeId(refereeId);
    if (existingReferral) {
      throw new BadRequestException('User already applied a referral code');
    }

    await this.referralsRepository.create({
      referrerId: referrer.id,
      refereeId,
      referralCode: code,
      status: ReferralStatus.PENDING,
    });
  }

  async getReferrals(userId: string) {
    return this.referralsRepository.findByReferrerId(userId);
  }

  async getTotalRewards(userId: string): Promise<number> {
    const referrals = await this.referralsRepository.findByReferrerId(userId);
    return referrals
      .filter((r) => r.status === ReferralStatus.COMPLETED)
      .reduce((sum, r) => sum + Number(r.rewardAmount), 0);
  }

  async getReferralLeaderboard() {
    const cacheKey = 'referral_leaderboard';
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    const leaderboard = await this.referralsRepository.getLeaderboard();
    // Cache for 60 seconds
    await this.cacheManager.set(cacheKey, leaderboard, 60000);
    return leaderboard;
  }

  async processReward(refereeId: string): Promise<void> {
    const referral = await this.referralsRepository.findPendingByRefereeId(refereeId);
    if (!referral) {
      return;
    }

    const referrer = referral.referrer;
    if (!referrer) {
      return;
    }

    let rewardAmount = 10; // BASE / FREE
    if (referrer.tier === UserTier.PREMIUM) {
      rewardAmount = 25;
    } else if (referrer.tier === UserTier.VIP) {
      rewardAmount = 50;
    }

    await this.referralsRepository.update(referral.id, {
      status: ReferralStatus.COMPLETED,
      rewardAmount,
      completedAt: new Date(),
    });
  }
}
