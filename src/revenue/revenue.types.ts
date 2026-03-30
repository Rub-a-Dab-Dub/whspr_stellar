export enum RevenueSourceType {
  TRANSFER_FEE = 'TRANSFER_FEE',
  SUBSCRIPTION = 'SUBSCRIPTION',
  SWAP_FEE = 'SWAP_FEE',
  TREASURY_FEE = 'TREASURY_FEE',
}

export interface StakeholderDistribution {
  stakeholder: string; // wallet address or 'treasury', 'referral_pool', etc.
  share: number; // numeric amount
  tokenId: string;
}

