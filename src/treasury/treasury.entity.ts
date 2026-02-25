export type TreasurySource = "TIP" | "ROOM_ENTRY";

export interface TreasuryEntry {
  id: string;
  txHash: string;
  feeAmount: string; // store as string to avoid float issues
  tokenAddress: string;
  chain: string;
  source: TreasurySource;
  collectedAt: Date;
}
