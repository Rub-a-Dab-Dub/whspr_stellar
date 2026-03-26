import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository } from '../users/users.repository';
import { UserTier } from '../users/entities/user.entity';
import { TIER_BENEFITS, TierDetails } from './membership-tier.constants';

@Injectable()
export class MembershipTierService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async getTierBenefits(tier: UserTier): Promise<TierDetails> {
    const details = TIER_BENEFITS[tier];
    if (!details) {
      throw new NotFoundException(`Benefits for tier ${tier} not found`);
    }
    return details;
  }

  async getAllTiers(): Promise<TierDetails[]> {
    return Object.values(TIER_BENEFITS);
  }

  async getUserTierDetails(userId: string): Promise<TierDetails & { current: boolean }> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const details = await this.getTierBenefits(user.tier);
    return {
      ...details,
      current: true,
    };
  }

  async upgradeTier(userId: string, newTier: UserTier): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // In a real scenario, we'd check if they paid or met criteria.
    // For now, we'll just update the tier.
    user.tier = newTier;
    await this.usersRepository.save(user);
  }
}
