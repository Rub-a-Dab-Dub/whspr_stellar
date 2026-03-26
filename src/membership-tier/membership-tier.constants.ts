import { UserTier } from '../users/entities/user.entity';

export interface TierBenefit {
  name: string;
  description: string;
  value: string | number | boolean;
}

export interface TierDetails {
  tier: UserTier;
  label: string;
  benefits: TierBenefit[];
}

export const TIER_BENEFITS: Record<UserTier, TierDetails> = {
  [UserTier.SILVER]: {
    tier: UserTier.SILVER,
    label: 'Silver',
    benefits: [
      { name: 'Max File Size', description: 'Maximum size for attachments', value: '10MB' },
      { name: 'Standard Rate Limit', description: 'Standard API request limit', value: '3 req/sec' },
      { name: 'Basic Features', description: 'Access to all standard platform features', value: true },
    ],
  },
  [UserTier.GOLD]: {
    tier: UserTier.GOLD,
    label: 'Gold',
    benefits: [
      { name: 'Max File Size', description: 'Increased size for attachments', value: '25MB' },
      { name: 'Enpriority Rate Limit', description: 'Higher API request limit', value: '10 req/sec' },
      { name: 'Priority Support', description: 'Faster response from support team', value: true },
      { name: 'Advanced Analytics', description: 'View detailed insights for your account', value: true },
    ],
  },
  [UserTier.BLACK]: {
    tier: UserTier.BLACK,
    label: 'Black',
    benefits: [
      { name: 'Max File Size', description: 'Premium size for attachments', value: '50MB' },
      { name: 'Unlimited Limit', description: 'Extremely high API request limit', value: 'Unlimited*' },
      { name: 'VIP Support', description: 'Dedicated account manager', value: true },
      { name: 'Exclusive Access', description: 'Early access to new features and beta tests', value: true },
      { name: 'Custom Profile', description: 'Exclusive badges and profile customization', value: true },
    ],
  },
};
