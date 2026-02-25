import { Badge, BadgeRarity } from "./badge.entity";
import { UserBadge } from "./userBadge.entity";

export class BadgeService {
  private badges: Badge[] = [];
  private userBadges: UserBadge[] = [];

  async getAllBadges(): Promise<Badge[]> {
    return this.badges;
  }

  async getUserBadges(userId: string): Promise<UserBadge[]> {
    return this.userBadges.filter((ub) => ub.userId === userId);
  }

  async awardBadge(userId: string, badgeId: string): Promise<UserBadge> {
    const badge = this.badges.find((b) => b.id === badgeId);
    if (!badge) throw new Error("Badge not found");

    const userBadge: UserBadge = {
      id: crypto.randomUUID(),
      userId,
      badgeId,
      earnedAt: new Date(),
      nftTokenId: null,
    };
    this.userBadges.push(userBadge);
    return userBadge;
  }

  async mintBadge(userBadgeId: string): Promise<UserBadge> {
    const ub = this.userBadges.find((u) => u.id === userBadgeId);
    if (!ub) throw new Error("UserBadge not found");

    // Call NFT contract (pseudo-code)
    const nftTokenId = await mintBadgeNFT(ub.badgeId, ub.userId);
    ub.nftTokenId = nftTokenId;
    return ub;
  }
}
