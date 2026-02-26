export type BadgeRarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";

export interface Badge {
  id: string;
  name: string;
  description: string;
  imageIpfsHash: string;
  rarity: BadgeRarity;
  questId: string;
}
