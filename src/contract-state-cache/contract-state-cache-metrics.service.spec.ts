import { ContractStateCacheMetricsService } from './contract-state-cache-metrics.service';
import { ContractStateKeyType } from './contract-state-key-type.enum';

describe('ContractStateCacheMetricsService', () => {
  it('computes hit rate per contract and key type', () => {
    const m = new ContractStateCacheMetricsService();
    m.recordHit('C1', ContractStateKeyType.USER_REGISTRY);
    m.recordHit('C1', ContractStateKeyType.USER_REGISTRY);
    m.recordMiss('C1', ContractStateKeyType.USER_REGISTRY);
    const snap = m.getSnapshot();
    expect(snap.totals.hits).toBe(2);
    expect(snap.totals.misses).toBe(1);
    expect(snap.totals.hitRate).toBeCloseTo(2 / 3);
    const row = snap.byContractAndKeyType.find((r) => r.contractAddress === 'C1');
    expect(row?.hitRate).toBeCloseTo(2 / 3);
  });

  it('reset clears counters', () => {
    const m = new ContractStateCacheMetricsService();
    m.recordHit('C1', ContractStateKeyType.KEY_RECORD);
    m.reset();
    expect(m.getSnapshot().totals.hits).toBe(0);
  });
});
