import { SetMetadata } from '@nestjs/common';
import { UserTier } from '../../users/entities/user.entity';

export const TIER_KEY = 'tier';
export const RequiredTier = (tier: UserTier) => SetMetadata(TIER_KEY, tier);
