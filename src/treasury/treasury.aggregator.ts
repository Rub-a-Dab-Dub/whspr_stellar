import { TreasuryEntry } from "./treasury.entity";

export class TreasuryAggregator {
  static aggregate(entries: TreasuryEntry[], period: "daily" | "weekly" | "monthly") {
    const buckets: Record<string, bigint> = {};
    for (const e of entries) {
      const date = new Date(e.collectedAt);
      let key: string;
      if (period === "daily") {
        key = date.toISOString().split("T")[0];
      } else if (period === "weekly") {
        const week = Math.floor(date.getDate() / 7);
        key = `${date.getFullYear()}-W${week}`;
      } else {
        key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      }
      if (!buckets[key]) buckets[key] = 0n;
      buckets[key] += BigInt(e.feeAmount);
    }
    return buckets;
  }
}
