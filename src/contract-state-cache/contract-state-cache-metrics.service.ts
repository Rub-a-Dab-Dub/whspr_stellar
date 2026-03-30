import { Injectable } from '@nestjs/common';
import { ContractStateKeyType } from './contract-state-key-type.enum';

export type ContractCacheHitRateRow = {
  contractAddress: string;
  keyType: ContractStateKeyType;
  hits: number;
  misses: number;
  hitRate: number;
};

@Injectable()
export class ContractStateCacheMetricsService {
  private readonly hits = new Map<string, number>();
  private readonly misses = new Map<string, number>();

  private key(contractAddress: string, keyType: ContractStateKeyType): string {
    return `${contractAddress}|${keyType}`;
  }

  recordHit(contractAddress: string, keyType: ContractStateKeyType): void {
    const k = this.key(contractAddress, keyType);
    this.hits.set(k, (this.hits.get(k) ?? 0) + 1);
  }

  recordMiss(contractAddress: string, keyType: ContractStateKeyType): void {
    const k = this.key(contractAddress, keyType);
    this.misses.set(k, (this.misses.get(k) ?? 0) + 1);
  }

  getSnapshot(): { byContractAndKeyType: ContractCacheHitRateRow[]; totals: { hits: number; misses: number; hitRate: number } } {
    const keys = new Set([...this.hits.keys(), ...this.misses.keys()]);
    const byContractAndKeyType: ContractCacheHitRateRow[] = [];
    let th = 0;
    let tm = 0;

    for (const k of keys) {
      const [contractAddress, keyType] = k.split('|') as [string, ContractStateKeyType];
      const h = this.hits.get(k) ?? 0;
      const m = this.misses.get(k) ?? 0;
      th += h;
      tm += m;
      const total = h + m;
      byContractAndKeyType.push({
        contractAddress,
        keyType,
        hits: h,
        misses: m,
        hitRate: total === 0 ? 0 : h / total,
      });
    }

    const t = th + tm;
    return {
      byContractAndKeyType: byContractAndKeyType.sort((a, b) => b.hits + b.misses - (a.hits + a.misses)),
      totals: {
        hits: th,
        misses: tm,
        hitRate: t === 0 ? 0 : th / t,
      },
    };
  }

  reset(): void {
    this.hits.clear();
    this.misses.clear();
  }
}
