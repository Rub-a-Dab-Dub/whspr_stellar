export interface UserBadge {
  id: string;
  userId: string;
  badgeId: string;
  earnedAt: Date;
  nftTokenId?: string | null;
}
