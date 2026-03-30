import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { OfflineQueueService, QueuedMessage } from './offline-queue.service';
import { OfflineMessageQueue, QueueStatus } from './entities/offline-message-queue.entity';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<QueuedMessage> = {}): QueuedMessage {
  return {
    messageId: 'msg-1',
    conversationId: 'conv-1',
    payload: { content: 'hello' },
    queuedAt: Date.now(),
    ...overrides,
  };
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockQueueRepo = {
  count: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const zsetStore: Map<string, Map<string, number>> = new Map();

const mockRedis = {
  zadd: jest.fn(async (key: string, score: number, value: string) => {
    if (!zsetStore.has(key)) zsetStore.set(key, new Map());
    zsetStore.get(key)!.set(value, score);
    return 1;
  }),
  zcard: jest.fn(async (key: string) => zsetStore.get(key)?.size ?? 0),
  zrangebyscore: jest.fn(async (key: string) => {
    const set = zsetStore.get(key);
    if (!set) return [];
    return [...set.entries()]
      .sort(([, a], [, b]) => a - b)
      .map(([v]) => v);
  }),
  zrem: jest.fn(async (key: string, value: string) => {
    zsetStore.get(key)?.delete(value);
    return 1;
  }),
  scan: jest.fn(async () => ['0', []]),
};

const mockConfigService = {
  get: jest.fn((key: string, def?: unknown) => def),
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('OfflineQueueService', () => {
  let service: OfflineQueueService;

  beforeEach(async () => {
    jest.clearAllMocks();
    zsetStore.clear();

    // Set up createQueryBuilder chain
    const qbMock = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({}),
    };
    mockQueueRepo.createQueryBuilder.mockReturnValue(qbMock);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OfflineQueueService,
        { provide: getRepositoryToken(OfflineMessageQueue), useValue: mockQueueRepo },
        { provide: 'OFFLINE_REDIS_CLIENT', useValue: mockRedis },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get(OfflineQueueService);
  });

  // ── enqueue ────────────────────────────────────────────────────────────────

  describe('enqueue', () => {
    it('adds an entry to the Redis sorted set', async () => {
      await service.enqueue({
        recipientId: 'user-1',
        messageId: 'msg-1',
        conversationId: 'conv-1',
        payload: { text: 'hi' },
      });

      expect(mockRedis.zadd).toHaveBeenCalledTimes(1);
      const [key, , value] = mockRedis.zadd.mock.calls[0] as [string, number, string];
      expect(key).toBe('offline:queue:user-1');
      const parsed = JSON.parse(value) as QueuedMessage;
      expect(parsed.messageId).toBe('msg-1');
    });

    it('checks queue depth and warns if > 1000', async () => {
      // Pre-fill zsetStore with 1001 entries
      const set = new Map<string, number>();
      for (let i = 0; i < 1001; i++) set.set(`entry-${i}`, i);
      zsetStore.set('offline:queue:user-big', set);

      const warnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {});
      await service.enqueue({
        recipientId: 'user-big',
        messageId: 'new-msg',
        conversationId: 'conv-1',
        payload: {},
      });
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ALERT'));
    });
  });

  // ── dequeueForUser ─────────────────────────────────────────────────────────

  describe('dequeueForUser', () => {
    it('returns entries in chronological order', async () => {
      const older = makeEntry({ messageId: 'msg-old', queuedAt: 1000 });
      const newer = makeEntry({ messageId: 'msg-new', queuedAt: 2000 });

      const set = new Map<string, number>();
      set.set(JSON.stringify(newer), 2000);
      set.set(JSON.stringify(older), 1000);
      zsetStore.set('offline:queue:user-1', set);

      const result = await service.dequeueForUser('user-1');
      expect(result[0].messageId).toBe('msg-old');
      expect(result[1].messageId).toBe('msg-new');
    });

    it('returns empty array for unknown user', async () => {
      const result = await service.dequeueForUser('unknown');
      expect(result).toEqual([]);
    });
  });

  // ── markDelivered ──────────────────────────────────────────────────────────

  describe('markDelivered', () => {
    it('removes the entry from Redis and updates Postgres', async () => {
      const entry = makeEntry({ messageId: 'msg-1' });
      const set = new Map([[JSON.stringify(entry), entry.queuedAt]]);
      zsetStore.set('offline:queue:user-1', set);

      mockQueueRepo.update.mockResolvedValue({ affected: 1 });
      await service.markDelivered('user-1', 'msg-1');

      expect(mockRedis.zrem).toHaveBeenCalled();
      expect(mockQueueRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ recipientId: 'user-1', messageId: 'msg-1' }),
        expect.objectContaining({ status: QueueStatus.DELIVERED }),
      );
    });

    it('is a no-op for messages not in the queue', async () => {
      mockQueueRepo.update.mockResolvedValue({ affected: 0 });
      await service.markDelivered('user-1', 'msg-not-exist');
      expect(mockRedis.zrem).not.toHaveBeenCalled();
    });
  });

  // ── retryFailed ────────────────────────────────────────────────────────────

  describe('retryFailed', () => {
    it('resets FAILED records to QUEUED and returns count', async () => {
      mockQueueRepo.update.mockResolvedValue({ affected: 3 });
      const count = await service.retryFailed('user-1');
      expect(count).toBe(3);
      expect(mockQueueRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: QueueStatus.FAILED }),
        expect.objectContaining({ status: QueueStatus.QUEUED }),
      );
    });
  });

  // ── getQueueDepth ──────────────────────────────────────────────────────────

  describe('getQueueDepth', () => {
    it('returns Redis zcard for the user key', async () => {
      const set = new Map<string, number>([['a', 1], ['b', 2]]);
      zsetStore.set('offline:queue:user-2', set);

      const depth = await service.getQueueDepth('user-2');
      expect(depth).toBe(2);
    });

    it('returns 0 for user with no queue', async () => {
      expect(await service.getQueueDepth('nobody')).toBe(0);
    });
  });

  // ── flushOnConnect ─────────────────────────────────────────────────────────

  describe('flushOnConnect', () => {
    function buildMockServer(socketId: string) {
      const emitFn = jest.fn();
      const server = {
        to: jest.fn().mockReturnValue({ emit: emitFn }),
      } as unknown as import('socket.io').Server;
      return { server, emitFn };
    }

    it('emits sync:start and sync:complete with correct counts', async () => {
      const entry = makeEntry({ messageId: 'msg-1' });
      const set = new Map([[JSON.stringify(entry), entry.queuedAt]]);
      zsetStore.set('offline:queue:user-1', set);

      mockQueueRepo.update.mockResolvedValue({ affected: 1 });

      const { server, emitFn } = buildMockServer('socket-abc');
      await service.flushOnConnect('user-1', server, 'socket-abc');

      const eventNames = emitFn.mock.calls.map((c: unknown[]) => c[0]);
      expect(eventNames).toContain('sync:start');
      expect(eventNames).toContain('message:queued');
      expect(eventNames).toContain('sync:complete');
    });

    it('returns flushed=0, failed=0 when queue is empty', async () => {
      const { server } = buildMockServer('socket-abc');
      const result = await service.flushOnConnect('user-empty', server, 'socket-abc');
      expect(result).toEqual({ userId: 'user-empty', flushed: 0, failed: 0 });
    });

    it('includes replayed=true in each emitted message', async () => {
      const entry = makeEntry({ messageId: 'msg-replay' });
      const set = new Map([[JSON.stringify(entry), entry.queuedAt]]);
      zsetStore.set('offline:queue:user-1', set);

      mockQueueRepo.update.mockResolvedValue({ affected: 1 });

      const { server, emitFn } = buildMockServer('socket-abc');
      await service.flushOnConnect('user-1', server, 'socket-abc');

      const msgCall = emitFn.mock.calls.find((c: unknown[]) => c[0] === 'message:queued');
      expect(msgCall).toBeDefined();
      expect((msgCall as unknown[])[1]).toMatchObject({ replayed: true, messageId: 'msg-replay' });
    });
  });

  // ── pruneOld ───────────────────────────────────────────────────────────────

  describe('pruneOld', () => {
    it('deletes DELIVERED records older than 30 days', async () => {
      mockQueueRepo.delete.mockResolvedValue({ affected: 5 });
      const removed = await service.pruneOld();
      expect(removed).toBe(5);
      expect(mockQueueRepo.delete).toHaveBeenCalledWith(
        expect.objectContaining({ status: QueueStatus.DELIVERED }),
      );
    });

    it('returns 0 when nothing to prune', async () => {
      mockQueueRepo.delete.mockResolvedValue({ affected: 0 });
      expect(await service.pruneOld()).toBe(0);
    });
  });

  // ── getStats ───────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('returns counts from repo and empty alertedUsers when no overflows', async () => {
      mockQueueRepo.count.mockResolvedValueOnce(10); // queued
      mockQueueRepo.count.mockResolvedValueOnce(200); // delivered
      mockQueueRepo.count.mockResolvedValueOnce(3);  // failed
      mockRedis.scan.mockResolvedValueOnce(['0', []]);

      const stats = await service.getStats();
      expect(stats.totalQueued).toBe(10);
      expect(stats.totalDelivered).toBe(200);
      expect(stats.totalFailed).toBe(3);
      expect(stats.alertedUsers).toEqual([]);
    });

    it('includes alerted users when Redis depth > 1000', async () => {
      mockQueueRepo.count.mockResolvedValue(0);
      mockRedis.scan.mockResolvedValueOnce(['0', ['offline:queue:user-heavy']]);
      // Override zcard for this test
      mockRedis.zcard.mockResolvedValueOnce(1500);

      const stats = await service.getStats();
      expect(stats.alertedUsers).toHaveLength(1);
      expect(stats.alertedUsers[0].userId).toBe('user-heavy');
      expect(stats.alertedUsers[0].depth).toBe(1500);
    });
  });

  // ── persistStaleRedisEntries ───────────────────────────────────────────────

  describe('persistStaleRedisEntries', () => {
    it('persists stale entries to Postgres if not already saved', async () => {
      const entry = makeEntry({ messageId: 'stale-msg', queuedAt: Date.now() - 2 * 60 * 60 * 1000 });
      mockRedis.scan.mockResolvedValueOnce(['0', ['offline:queue:user-1']]);
      mockRedis.zrangebyscore = jest.fn().mockResolvedValueOnce([JSON.stringify(entry)]);
      mockQueueRepo.findOne.mockResolvedValue(null);
      mockQueueRepo.create.mockReturnValue({});
      mockQueueRepo.save.mockResolvedValue({});

      await service.persistStaleRedisEntries();

      expect(mockQueueRepo.save).toHaveBeenCalledTimes(1);
    });

    it('skips entries already in Postgres', async () => {
      const entry = makeEntry({ messageId: 'stale-msg', queuedAt: Date.now() - 2 * 60 * 60 * 1000 });
      mockRedis.scan.mockResolvedValueOnce(['0', ['offline:queue:user-1']]);
      mockRedis.zrangebyscore = jest.fn().mockResolvedValueOnce([JSON.stringify(entry)]);
      mockQueueRepo.findOne.mockResolvedValue({ id: 'existing' });

      await service.persistStaleRedisEntries();

      expect(mockQueueRepo.save).not.toHaveBeenCalled();
    });
  });
});
