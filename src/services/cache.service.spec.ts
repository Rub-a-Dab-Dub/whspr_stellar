import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CacheService } from '../../src/services/cache.service';

const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [CacheService, { provide: CACHE_MANAGER, useValue: mockCacheManager }],
    }).compile();
    service = module.get(CacheService);
    service.resetStats();
  });

  // ── hit / miss tracking ──────────────────────────────────────────────────

  it('records a hit when value exists', async () => {
    mockCacheManager.get.mockResolvedValue('cached');
    await service.get('key');
    expect(service.getStats().hits).toBe(1);
    expect(service.getStats().misses).toBe(0);
  });

  it('records a miss when value is null', async () => {
    mockCacheManager.get.mockResolvedValue(null);
    await service.get('key');
    expect(service.getStats().misses).toBe(1);
    expect(service.getStats().hits).toBe(0);
  });

  it('calculates hit rate correctly', async () => {
    mockCacheManager.get.mockResolvedValueOnce('v').mockResolvedValueOnce(null);
    await service.get('k1');
    await service.get('k2');
    expect(service.getStats().hitRate).toBe(0.5);
  });

  // ── wrap (get-or-load) ───────────────────────────────────────────────────

  it('wrap returns cached value without calling loader', async () => {
    mockCacheManager.get.mockResolvedValue('cached');
    const loader = jest.fn();
    const result = await service.wrap('key', loader);
    expect(result).toBe('cached');
    expect(loader).not.toHaveBeenCalled();
  });

  it('wrap calls loader on miss and caches result', async () => {
    mockCacheManager.get.mockResolvedValue(null);
    mockCacheManager.set.mockResolvedValue(undefined);
    const loader = jest.fn().mockResolvedValue('fresh');
    const result = await service.wrap('key', loader, 60);
    expect(result).toBe('fresh');
    expect(mockCacheManager.set).toHaveBeenCalledWith('key', 'fresh', 60);
  });

  // ── invalidation ─────────────────────────────────────────────────────────

  it('del removes multiple keys', async () => {
    mockCacheManager.del.mockResolvedValue(undefined);
    await service.del('k1', 'k2', 'k3');
    expect(mockCacheManager.del).toHaveBeenCalledTimes(3);
  });

  // ── TTL / set ────────────────────────────────────────────────────────────

  it('set passes ttl to cache manager', async () => {
    mockCacheManager.set.mockResolvedValue(undefined);
    await service.set('key', 'value', 120);
    expect(mockCacheManager.set).toHaveBeenCalledWith('key', 'value', 120);
  });

  it('set without ttl uses undefined', async () => {
    mockCacheManager.set.mockResolvedValue(undefined);
    await service.set('key', 'value');
    expect(mockCacheManager.set).toHaveBeenCalledWith('key', 'value', undefined);
  });

  // ── cache warming ────────────────────────────────────────────────────────

  it('warm pre-loads all entries', async () => {
    mockCacheManager.get.mockResolvedValue(null);
    mockCacheManager.set.mockResolvedValue(undefined);
    const loaderA = jest.fn().mockResolvedValue('a');
    const loaderB = jest.fn().mockResolvedValue('b');
    await service.warm([
      { key: 'ka', loader: loaderA, ttl: 60 },
      { key: 'kb', loader: loaderB, ttl: 300 },
    ]);
    expect(loaderA).toHaveBeenCalled();
    expect(loaderB).toHaveBeenCalled();
    expect(mockCacheManager.set).toHaveBeenCalledTimes(2);
  });
});
