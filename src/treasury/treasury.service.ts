import { TreasuryEntry } from "./treasury.entity";

export class TreasuryService {
  private entries: TreasuryEntry[] = [];

  async recordFee(entry: TreasuryEntry) {
    this.entries.push(entry);
    return entry;
  }

  async getTotalFeesByTokenAndChain() {
    const totals: Record<string, Record<string, bigint>> = {};
    for (const e of this.entries) {
      if (!totals[e.chain]) totals[e.chain] = {};
      if (!totals[e.chain][e.tokenAddress]) totals[e.chain][e.tokenAddress] = 0n;
      totals[e.chain][e.tokenAddress] += BigInt(e.feeAmount);
    }
    return totals;
  }

  async getFeeHistory(page = 1, limit = 20, filters?: Partial<TreasuryEntry>) {
    let filtered = this.entries;
    if (filters?.chain) filtered = filtered.filter((e) => e.chain === filters.chain);
    if (filters?.tokenAddress) filtered = filtered.filter((e) => e.tokenAddress === filters.tokenAddress);
    const start = (page - 1) * limit;
    return filtered.slice(start, start + limit);
  }
}
