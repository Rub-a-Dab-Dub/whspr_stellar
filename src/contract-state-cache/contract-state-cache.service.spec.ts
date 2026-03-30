import { ContractStateCacheService } from './contract-state-cache.service';
import { ContractStateKeyType } from './contract-state-key-type.enum';
import { redisEntryKey } from './contract-state-cache.redis-keys';

describe('ContractStateCacheService', () => {
  let service: ContractStateCacheService;
  const entryRepo = {
    findOne: jest.fn(),
    upsert: jest.fn(),
    findOneOrFail: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const userRepo = { find: jest.fn() };
  const cache = { get: jest.fn(), set: jest.fn(), invalidatePattern: jest.fn() };
  const metrics = {
    recordHit: jest.fn(),
    recordMiss: jest.fn(),
    getSnapshot: jest.fn().mockReturnValue({ byContractAndKeyType: [], totals: { hits: 0, misses: 0, hitRate: 0 } }),
  };
  const getLatestLedger = jest.fn().mockResolvedValue({ sequence: 1000 });
  const sorobanClient = { getServer: jest.fn(() => ({ getLatestLedger })) };
  const userRegistry = { getUser: jest.fn() };
  const config = {
    get: jest.fn((k: string, d?: string) => {
      if (k === 'USER_REGISTRY_CONTRACT_ID') return '';
      if (k === 'CONTRACT_CACHE_STALE_LEDGER_DELTA') return '3';
      return d ?? '';
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getLatestLedger.mockResolvedValue({ sequence: 1000 });
    config.get.mockImplementation((k: string, d?: string) => {
      if (k === 'USER_REGISTRY_CONTRACT_ID') return '';
      if (k === 'CONTRACT_CACHE_STALE_LEDGER_DELTA') return '3';
      return d ?? '';
    });
    service = new ContractStateCacheService(
      entryRepo as any,
      userRepo as any,
      cache as any,
      metrics as any,
      sorobanClient as any,
      userRegistry as any,
      config as any,
    );
  });

  it('get returns redis hit and records hit metric', async () => {
    const env = {
      v: { ok: true },
      ledger: 999,
      cachedAt: new Date().toISOString(),
      keyType: ContractStateKeyType.USER_REGISTRY,
      contractAddress: 'CCON',
      stateKey: 'USER_REGISTRY:u1',
    };
    cache.get.mockResolvedValue(env);
    const out = await service.get('CCON', 'USER_REGISTRY:u1', ContractStateKeyType.USER_REGISTRY);
    expect(out?.source).toBe('redis');
    expect(out?.value).toEqual({ ok: true });
    expect(metrics.recordHit).toHaveBeenCalledWith('CCON', ContractStateKeyType.USER_REGISTRY);
  });

  it('get falls back to postgres and repopulates redis', async () => {
    cache.get.mockResolvedValue(null);
    const row = {
      stateValue: { x: 1 },
      ledger: '998',
      cachedAt: new Date(),
      keyType: ContractStateKeyType.TOKEN_BALANCE,
      ttlSeconds: 120,
      contractAddress: 'CCON',
      stateKey: 'TOK:a',
    };
    entryRepo.findOne.mockResolvedValue(row);
    const out = await service.get('CCON', 'TOK:a', ContractStateKeyType.TOKEN_BALANCE);
    expect(out?.source).toBe('postgres');
    expect(cache.set).toHaveBeenCalledWith(
      redisEntryKey('CCON', 'TOK:a'),
      expect.objectContaining({ v: { x: 1 } }),
      120,
    );
  });

  it('get records miss when absent', async () => {
    cache.get.mockResolvedValue(null);
    entryRepo.findOne.mockResolvedValue(null);
    await expect(service.get('CCON', 'missing')).resolves.toBeNull();
    expect(metrics.recordMiss).toHaveBeenCalled();
  });

  it('upsertFromChain writes pg and redis', async () => {
    entryRepo.findOneOrFail.mockResolvedValue({
      contractAddress: 'CCON',
      stateKey: 'k',
      keyType: ContractStateKeyType.KEY_RECORD,
      stateValue: { a: 1 },
      ledger: '1000',
      cachedAt: new Date(),
      ttlSeconds: 300,
    });
    await service.upsertFromChain('CCON', 'k', ContractStateKeyType.KEY_RECORD, { a: 1 }, 1000, 300);
    expect(entryRepo.upsert).toHaveBeenCalled();
    expect(cache.set).toHaveBeenCalled();
  });

  it('invalidate clears redis pattern and postgres rows', async () => {
    entryRepo.delete.mockResolvedValue({ affected: 5 });
    await expect(service.invalidate('CCON')).resolves.toEqual({ postgresRowsRemoved: 5 });
    expect(cache.invalidatePattern).toHaveBeenCalled();
  });

  it('bulkGet maps items', async () => {
    cache.get.mockResolvedValue(null);
    entryRepo.findOne.mockResolvedValue(null);
    const out = await service.bulkGet([
      { contractAddress: 'C1', stateKey: 'a' },
      { contractAddress: 'C2', stateKey: 'b' },
    ]);
    expect(out).toHaveLength(2);
    expect(out.every((x) => x === null)).toBe(true);
  });

  it('syncFromChain uses fetcher value', async () => {
    entryRepo.findOneOrFail.mockResolvedValue({
      contractAddress: 'C',
      stateKey: 'sk',
      keyType: ContractStateKeyType.GROUP_MEMBERSHIP,
      stateValue: [1],
      ledger: '1000',
      cachedAt: new Date(),
      ttlSeconds: 300,
    });
    await service.syncFromChain('C', 'sk', ContractStateKeyType.GROUP_MEMBERSHIP, async () => ({
      value: [1],
      ledger: 1000,
    }));
    expect(entryRepo.upsert).toHaveBeenCalled();
  });

  it('warmCache skips when USER_REGISTRY_CONTRACT_ID unset', async () => {
    config.get.mockReturnValue('');
    await expect(service.warmCache({ userLimit: 10 })).resolves.toMatchObject({
      warmed: 0,
      skipped: 0,
    });
    expect(userRepo.find).not.toHaveBeenCalled();
  });

  it('getCacheStats aggregates counts', async () => {
    entryRepo.count.mockResolvedValue(7);
    entryRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(2),
    });
    const stats = await service.getCacheStats();
    expect(stats.postgresRowCount).toBe(7);
    expect(stats.staleEntryCount).toBe(2);
    expect(stats.latestLedger).toBe(1000);
  });

  it('get treats stale as false when latest ledger RPC fails', async () => {
    getLatestLedger.mockRejectedValue(new Error('rpc down'));
    cache.get.mockResolvedValue(null);
    entryRepo.findOne.mockResolvedValue({
      stateValue: {},
      ledger: '1',
      cachedAt: new Date(),
      keyType: ContractStateKeyType.KEY_RECORD,
      ttlSeconds: 60,
      contractAddress: 'CC',
      stateKey: 'k',
    });
    const out = await service.get('CC', 'k');
    expect(out?.stale).toBe(false);
  });

  it('set delegates to upsertFromChain', async () => {
    const spy = jest.spyOn(service, 'upsertFromChain').mockResolvedValue({} as any);
    await service.set('C', 'k', ContractStateKeyType.KEY_RECORD, { x: 1 }, 9, 11);
    expect(spy).toHaveBeenCalledWith('C', 'k', ContractStateKeyType.KEY_RECORD, { x: 1 }, 9, 11);
    spy.mockRestore();
  });

  it('syncFromChain uses head ledger when fetcher omits ledger', async () => {
    entryRepo.findOneOrFail.mockResolvedValue({
      contractAddress: 'CCON',
      stateKey: 'sk',
      keyType: ContractStateKeyType.GROUP_MEMBERSHIP,
      stateValue: { z: 1 },
      ledger: '1000',
      cachedAt: new Date(),
      ttlSeconds: 300,
    });
    await service.syncFromChain('CCON', 'sk', ContractStateKeyType.GROUP_MEMBERSHIP, async () => ({
      value: { z: 1 },
    }));
    expect(entryRepo.upsert).toHaveBeenCalled();
  });

  it('warmCache sets timedOut when budget is exhausted before any RPC', async () => {
    config.get.mockImplementation((k: string, d?: string) => {
      if (k === 'USER_REGISTRY_CONTRACT_ID') return 'CREG';
      if (k === 'CONTRACT_CACHE_DEFAULT_TTL_SEC') return '300';
      if (k === 'CONTRACT_CACHE_STALE_LEDGER_DELTA') return '3';
      return d ?? '';
    });
    userRepo.find.mockResolvedValue([{ id: 'user-a', isActive: true }]);
    const r = await service.warmCache({ userLimit: 5, maxDurationMs: -1 });
    expect(r.timedOut).toBe(true);
    expect(r.warmed).toBe(0);
    expect(userRegistry.getUser).not.toHaveBeenCalled();
  });

  it('warmCache increments skipped when getUser fails', async () => {
    config.get.mockImplementation((k: string, d?: string) => {
      if (k === 'USER_REGISTRY_CONTRACT_ID') return 'CREG';
      if (k === 'CONTRACT_CACHE_DEFAULT_TTL_SEC') return '300';
      if (k === 'CONTRACT_CACHE_STALE_LEDGER_DELTA') return '3';
      return d ?? '';
    });
    userRepo.find.mockResolvedValue([{ id: 'bad-user', isActive: true }]);
    userRegistry.getUser.mockRejectedValue(new Error('rpc error'));
    const r = await service.warmCache({ userLimit: 2, maxDurationMs: 10_000 });
    expect(r.skipped).toBe(1);
    expect(r.warmed).toBe(0);
  });

  it('warmCache hydrates user registry rows for active users', async () => {
    config.get.mockImplementation((k: string, d?: string) => {
      if (k === 'USER_REGISTRY_CONTRACT_ID') return 'CREG';
      if (k === 'CONTRACT_CACHE_DEFAULT_TTL_SEC') return '300';
      if (k === 'CONTRACT_CACHE_STALE_LEDGER_DELTA') return '3';
      return d ?? '';
    });
    userRepo.find.mockResolvedValue([{ id: 'user-a', isActive: true }]);
    userRegistry.getUser.mockResolvedValue({ ok: true });
    entryRepo.findOneOrFail.mockResolvedValue({
      contractAddress: 'CREG',
      stateKey: 'USER_REGISTRY:user-a',
      keyType: ContractStateKeyType.USER_REGISTRY,
      stateValue: { ok: true },
      ledger: '1000',
      cachedAt: new Date(),
      ttlSeconds: 300,
    });
    const r = await service.warmCache({ userLimit: 5, maxDurationMs: 30_000 });
    expect(r.warmed).toBe(1);
    expect(userRegistry.getUser).toHaveBeenCalledWith('user-a');
  });
});
