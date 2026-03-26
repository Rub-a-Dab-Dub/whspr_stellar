import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';
import { CacheMetricsService } from './cache-metrics.service';
import { RedlockService } from './redlock.service';
import { CACHE_TTL } from './cache.constants';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  scan: jest.fn(),
  ping: jest.fn(),
};

const mockMetrics = {
  recordHit: jest.fn(),
  recordMiss: jest.fn(),
  recordError: jest.fn(),
};

const mockRedlock = {
  withLock: jest.fn().mockImplementation((_resource: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: CacheService,
          useFactory: () => new CacheService(mockRedis as any, mockMetrics as any, mockRedlock as any),
        },
      ],
    }).compile();

    service = module.get(CacheService);
  });

  // ── get ───────────────────────────────────────────────────────────────────

  describe('get()', () => {
    it('returns parsed value and records hit on cache hit', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ id: '1' }));
      const result = await service.get<{ id: string }>('user:1');
      expect(result).toEqual({ id: '1' });
      expect(mockMetrics.recordHit).toHaveBeenCalledWith('user');
      expect(mockMetrics.recordMiss).not.toHaveBeenCalled();
    });

    it('returns null and records miss on cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);
      const result = await service.get('user:1');
      expect(result).toBeNull();
      expect(mockMetrics.recordMiss).toHaveBeenCalledWith('user');
    });

    it('returns null and records error when Redis throws', async () => {
      mockRedis.get.mockRejectedValue(new Error('connection refused'));
      const result = await service.get('user:1');
      expect(result).toBeNull();
      expect(mockMetrics.recordError).toHaveBeenCalledWith('get');
    });
  });

  // ── set ───────────────────────────────────────────────────────────────────

  describe('set()', () => {
    it('calls redis.set with serialised value and TTL', async () => {
      mockRedis.set.mockResolvedValue('OK');
      await service.set('user:1', { id: '1' }, 300);
      expect(mockRedis.set).toHaveBeenCalledWith('user:1', JSON.stringify({ id: '1' }), 'EX', 300);
    });

    it('records error and does not throw when Redis fails', async () => {
      mockRedis.set.mockRejectedValue(new Error('timeout'));
      await expect(service.set('user:1', {}, 60)).resolves.toBeUndefined();
      expect(mockMetrics.recordError).toHaveBeenCalledWith('set');
    });
  });

  // ── del ───────────────────────────────────────────────────────────────────

  describe('del()', () => {
    it('calls redis.del with the key', async () => {
      mockRedis.del.mockResolvedValue(1);
      await service.del('user:1');
      expect(mockRedis.del).toHaveBeenCalledWith('user:1');
    });

    it('records error and does not throw when Redis fails', async () => {
      mockRedis.del.mockRejectedValue(new Error('timeout'));
      await expect(service.del('user:1')).resolves.toBeUndefined();
      expect(mockMetrics.recordError).toHaveBeenCalledWith('del');
    });
  });

  // ── invalidatePattern ─────────────────────────────────────────────────────

  describe('invalidatePattern()', () => {
    it('scans and deletes matching keys', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['42', ['user:1:settings', 'user:1:wallet']])
        .mockResolvedValueOnce(['0', []]);
      await service.invalidatePattern('user:1:*');
      expect(mockRedis.del).toHaveBeenCalledWith('user:1:settings', 'user:1:wallet');
    });

    it('skips del call when scan returns no keys', async () => {
      mockRedis.scan.mockResolvedValueOnce(['0', []]);
      await service.invalidatePattern('user:99:*');
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('records error and does not throw on Redis failure', async () => {
      mockRedis.scan.mockRejectedValue(new Error('Redis down'));
      await expect(service.invalidatePattern('user:*')).resolves.toBeUndefined();
      expect(mockMetrics.recordError).toHaveBeenCalledWith('invalidate_pattern');
    });
  });

  // ── invalidateMany ────────────────────────────────────────────────────────

  describe('invalidateMany()', () => {
    it('deletes all provided keys in one call', async () => {
      mockRedis.del.mockResolvedValue(2);
      await service.invalidateMany(['user:1', 'wallet:1']);
      expect(mockRedis.del).toHaveBeenCalledWith('user:1', 'wallet:1');
    });

    it('does nothing for an empty array', async () => {
      await service.invalidateMany([]);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  // ── getOrSet ──────────────────────────────────────────────────────────────

  describe('getOrSet()', () => {
    it('returns cached value without calling fetcher on hit', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ id: '1' }));
      const fetcher = jest.fn();
      const result = await service.getOrSet('user:1', CACHE_TTL.USER, fetcher);
      expect(result).toEqual({ id: '1' });
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('calls fetcher and caches result on miss', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      const fetcher = jest.fn().mockResolvedValue({ id: '1' });
      const result = await service.getOrSet('user:1', CACHE_TTL.USER, fetcher);
      expect(result).toEqual({ id: '1' });
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(mockRedis.set).toHaveBeenCalledWith('user:1', JSON.stringify({ id: '1' }), 'EX', CACHE_TTL.USER);
    });

    it('uses distributed lock when fetching from source', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');
      const fetcher = jest.fn().mockResolvedValue({ id: '1' });
      await service.getOrSet('user:1', CACHE_TTL.USER, fetcher);
      expect(mockRedlock.withLock).toHaveBeenCalledWith('lock:user:1', 5_000, expect.any(Function));
    });
  });

  // ── mutation hooks ────────────────────────────────────────────────────────

  describe('mutation hooks', () => {
    beforeEach(() => {
      mockRedis.scan.mockResolvedValue(['0', []]);
      mockRedis.del.mockResolvedValue(1);
    });

    it('onUserMutated invalidates user pattern and direct key', async () => {
      await service.onUserMutated('42');
      expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', 'user:42:*', 'COUNT', 100);
      expect(mockRedis.del).toHaveBeenCalledWith('user:42');
    });

    it('onWalletMutated deletes the wallet key', async () => {
      await service.onWalletMutated('42');
      expect(mockRedis.del).toHaveBeenCalledWith('wallet:42');
    });

    it('onConversationMutated invalidates conversation pattern and direct key', async () => {
      await service.onConversationMutated('conv-1');
      expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', 'conversation:conv-1:*', 'COUNT', 100);
      expect(mockRedis.del).toHaveBeenCalledWith('conversation:conv-1');
    });

    it('onGroupMutated deletes the members key', async () => {
      await service.onGroupMutated('grp-1');
      expect(mockRedis.del).toHaveBeenCalledWith('group:grp-1:members');
    });
  });

  // ── ping ──────────────────────────────────────────────────────────────────

  describe('ping()', () => {
    it('returns true when Redis responds PONG', async () => {
      mockRedis.ping.mockResolvedValue('PONG');
      expect(await service.ping()).toBe(true);
    });

    it('returns false when Redis throws', async () => {
      mockRedis.ping.mockRejectedValue(new Error('down'));
      expect(await service.ping()).toBe(false);
    });
  });

  // ── ttl constants ─────────────────────────────────────────────────────────

  describe('ttl getter', () => {
    it('exposes CACHE_TTL constants', () => {
      expect(service.ttl).toBe(CACHE_TTL);
      expect(service.ttl.USER).toBe(300);
    });
  });
});