import { redisContractPattern, redisEntryKey } from './contract-state-cache.redis-keys';

describe('contract-state-cache.redis-keys', () => {
  it('produces deterministic entry keys per contract + stateKey', () => {
    const a = redisEntryKey('CCON', 'USER_REGISTRY:u1');
    const b = redisEntryKey('CCON', 'USER_REGISTRY:u1');
    const c = redisEntryKey('CCON', 'USER_REGISTRY:u2');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^soroban:cs:v1:c:[a-f0-9]{32}:k:[a-f0-9]{32}$/u);
  });

  it('pattern prefix matches redis entry keys for same contract', () => {
    const contract = 'CDEMOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABCD';
    const k = redisEntryKey(contract, 'k');
    const p = redisContractPattern(contract);
    expect(k.startsWith(p.replace(/\*$/u, ''))).toBe(true);
  });
});
