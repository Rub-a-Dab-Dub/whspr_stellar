import { UserTier } from '../../users/entities/user.entity';

const TIER_RANK: Record<UserTier, number> = {
  [UserTier.SILVER]: 0,
  [UserTier.GOLD]: 1,
  [UserTier.BLACK]: 2,
};

export function parseUserTier(value: string): UserTier | null {
  const v = value.trim().toLowerCase();
  if (v === UserTier.SILVER) return UserTier.SILVER;
  if (v === UserTier.GOLD) return UserTier.GOLD;
  if (v === UserTier.BLACK) return UserTier.BLACK;
  return null;
}

export function userMeetsMinTier(userTier: UserTier, required: UserTier): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[required];
}
