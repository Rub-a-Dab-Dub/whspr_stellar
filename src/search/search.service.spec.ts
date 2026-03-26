import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { SearchService } from './search.service';
import { SearchQueryDto, SearchType } from './dto/search-query.dto';

const makeDto = (overrides: Partial<SearchQueryDto> = {}): SearchQueryDto => ({
  q: 'test',
  type: SearchType.ALL,
  limit: 20,
  ...overrides,
});

const mockUser = {
  id: 'u1',
  username: 'alice',
  displayName: 'Alice',
  avatarUrl: null,
  walletAddress: '0xabc',
  rank: '0.5',
  highlight: '<b>alice</b>',
};

const mockGroup = {
  id: 'g1',
  name: 'General',
  description: 'Main channel',
  isPublic: true,
  createdAt: new Date(),
  rank: '0.4',
  highlight: '<b>General</b>',
};

const mockMessage = {
  id: 'm1',
  content: 'Hello test world',
  groupId: 'g1',
  senderId: 'u1',
  createdAt: new Date(),
  rank: '0.3',
  highlight: 'Hello <b>test</b> world',
};

const mockToken = {
  id: 't1',
  symbol: 'XLM',
  name: 'Stellar Lumens',
  contractAddress: null,
  network: 'stellar_mainnet',
  createdAt: new Date(),
  rank: '0.6',
  highlight: '<b>XLM</b> Stellar Lumens',
};

describe('SearchService', () => {
  let service: SearchService;
  let dataSource: { query: jest.Mock };
  let cacheManager: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    dataSource = { query: jest.fn() };
    cacheManager = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: DataSource, useValue: dataSource },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── search() ──────────────────────────────────────────────────────────────

  describe('search()', () => {
    it('returns cached result when cache hit', async () => {
      const cached = { results: [], total: 0, took: 5 };
      cacheManager.get.mockResolvedValue(cached);

      const result = await service.search(makeDto());

      expect(cacheManager.get).toHaveBeenCalledTimes(1);
      expect(dataSource.query).not.toHaveBeenCalled();
      expect(result.results).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('executes search and caches result on cache miss', async () => {
      cacheManager.get.mockResolvedValue(null);
      // global search: 4 pairs of [rows, count] queries
      dataSource.query
        .mockResolvedValueOnce([mockUser])        // users rows
        .mockResolvedValueOnce([{ total: '1' }])  // users count
        .mockResolvedValueOnce([mockGroup])        // groups rows
        .mockResolvedValueOnce([{ total: '1' }])  // groups count
        .mockResolvedValueOnce([mockMessage])      // messages rows
        .mockResolvedValueOnce([{ total: '1' }])  // messages count
        .mockResolvedValueOnce([mockToken])        // tokens rows
        .mockResolvedValueOnce([{ total: '1' }]); // tokens count

      const result = await service.search(makeDto());

      expect(result.results).toHaveLength(4);
      expect(result.total).toBe(4);
      expect(cacheManager.set).toHaveBeenCalledTimes(1);
    });

    it('routes to searchUsers when type=user', async () => {
      cacheManager.get.mockResolvedValue(null);
      dataSource.query
        .mockResolvedValueOnce([mockUser])
        .mockResolvedValueOnce([{ total: '1' }]);

      const result = await service.search(makeDto({ type: SearchType.USER }));

      expect(result.results[0].type).toBe(SearchType.USER);
    });

    it('routes to searchGroups when type=group', async () => {
      cacheManager.get.mockResolvedValue(null);
      dataSource.query
        .mockResolvedValueOnce([mockGroup])
        .mockResolvedValueOnce([{ total: '1' }]);

      const result = await service.search(makeDto({ type: SearchType.GROUP }));

      expect(result.results[0].type).toBe(SearchType.GROUP);
    });

    it('routes to searchMessages when type=message', async () => {
      cacheManager.get.mockResolvedValue(null);
      dataSource.query
        .mockResolvedValueOnce([mockMessage])
        .mockResolvedValueOnce([{ total: '1' }]);

      const result = await service.search(makeDto({ type: SearchType.MESSAGE }));

      expect(result.results[0].type).toBe(SearchType.MESSAGE);
    });

    it('routes to searchTokens when type=token', async () => {
      cacheManager.get.mockResolvedValue(null);
      dataSource.query
        .mockResolvedValueOnce([mockToken])
        .mockResolvedValueOnce([{ total: '1' }]);

      const result = await service.search(makeDto({ type: SearchType.TOKEN }));

      expect(result.results[0].type).toBe(SearchType.TOKEN);
    });

    it('provides nextCursor when more pages are available', async () => {
      cacheManager.get.mockResolvedValue(null);
      dataSource.query
        .mockResolvedValueOnce([mockUser])
        .mockResolvedValueOnce([{ total: '100' }]);

      const result = await service.search(makeDto({ type: SearchType.USER, limit: 1 }));

      expect(result.nextCursor).toBeDefined();
    });

    it('does not provide nextCursor on last page', async () => {
      cacheManager.get.mockResolvedValue(null);
      dataSource.query
        .mockResolvedValueOnce([mockUser])
        .mockResolvedValueOnce([{ total: '1' }]);

      const result = await service.search(makeDto({ type: SearchType.USER, limit: 20 }));

      expect(result.nextCursor).toBeUndefined();
    });
  });

  // ── searchUsers() ─────────────────────────────────────────────────────────

  describe('searchUsers()', () => {
    it('returns mapped user results', async () => {
      dataSource.query
        .mockResolvedValueOnce([mockUser])
        .mockResolvedValueOnce([{ total: '1' }]);

      const { rows, total } = await service.searchUsers(makeDto(), 20, 0);

      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe('u1');
      expect(rows[0].type).toBe(SearchType.USER);
      expect(rows[0].rank).toBe(0.5);
      expect(rows[0].data.username).toBe('alice');
      expect(total).toBe(1);
    });

    it('returns empty rows on database error', async () => {
      dataSource.query.mockRejectedValue(new Error('DB error'));

      const { rows, total } = await service.searchUsers(makeDto(), 20, 0);

      expect(rows).toHaveLength(0);
      expect(total).toBe(0);
    });

    it('returns empty results when no matches found', async () => {
      dataSource.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: '0' }]);

      const { rows, total } = await service.searchUsers(makeDto({ q: 'zzznomatch' }), 20, 0);

      expect(rows).toHaveLength(0);
      expect(total).toBe(0);
    });
  });

  // ── searchGroups() ────────────────────────────────────────────────────────

  describe('searchGroups()', () => {
    it('returns mapped group results', async () => {
      dataSource.query
        .mockResolvedValueOnce([mockGroup])
        .mockResolvedValueOnce([{ total: '1' }]);

      const { rows, total } = await service.searchGroups(makeDto(), 20, 0);

      expect(rows[0].id).toBe('g1');
      expect(rows[0].type).toBe(SearchType.GROUP);
      expect(rows[0].data.name).toBe('General');
      expect(total).toBe(1);
    });

    it('returns empty rows on database error', async () => {
      dataSource.query.mockRejectedValue(new Error('DB error'));

      const { rows } = await service.searchGroups(makeDto(), 20, 0);

      expect(rows).toHaveLength(0);
    });
  });

  // ── searchMessages() ──────────────────────────────────────────────────────

  describe('searchMessages()', () => {
    it('returns mapped message results', async () => {
      dataSource.query
        .mockResolvedValueOnce([mockMessage])
        .mockResolvedValueOnce([{ total: '1' }]);

      const { rows, total } = await service.searchMessages(makeDto(), 20, 0);

      expect(rows[0].id).toBe('m1');
      expect(rows[0].type).toBe(SearchType.MESSAGE);
      expect(rows[0].data.content).toBe('Hello test world');
      expect(total).toBe(1);
    });

    it('appends groupId filter condition', async () => {
      dataSource.query
        .mockResolvedValueOnce([mockMessage])
        .mockResolvedValueOnce([{ total: '1' }]);

      await service.searchMessages(
        makeDto({ groupId: 'g1' }),
        20,
        0,
      );

      const [sql, params] = dataSource.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('"groupId"');
      expect(params).toContain('g1');
    });

    it('appends dateFrom filter condition', async () => {
      dataSource.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: '0' }]);

      await service.searchMessages(makeDto({ dateFrom: '2024-01-01' }), 20, 0);

      const [sql, params] = dataSource.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('"createdAt" >=');
      expect(params.some((p) => p instanceof Date)).toBe(true);
    });

    it('appends dateTo filter condition', async () => {
      dataSource.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: '0' }]);

      await service.searchMessages(makeDto({ dateTo: '2024-12-31' }), 20, 0);

      const [sql] = dataSource.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('"createdAt" <=');
    });

    it('handles all filters combined', async () => {
      dataSource.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: '0' }]);

      await service.searchMessages(
        makeDto({ groupId: 'g1', dateFrom: '2024-01-01', dateTo: '2024-12-31' }),
        20,
        0,
      );

      const [sql, params] = dataSource.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('"groupId"');
      expect(sql).toContain('"createdAt" >=');
      expect(sql).toContain('"createdAt" <=');
      expect(params).toHaveLength(6); // q + groupId + dateFrom + dateTo + limit + offset
    });

    it('returns empty rows on database error', async () => {
      dataSource.query.mockRejectedValue(new Error('DB error'));

      const { rows } = await service.searchMessages(makeDto(), 20, 0);

      expect(rows).toHaveLength(0);
    });
  });

  // ── searchTokens() ────────────────────────────────────────────────────────

  describe('searchTokens()', () => {
    it('returns mapped token results', async () => {
      dataSource.query
        .mockResolvedValueOnce([mockToken])
        .mockResolvedValueOnce([{ total: '1' }]);

      const { rows, total } = await service.searchTokens(makeDto(), 20, 0);

      expect(rows[0].id).toBe('t1');
      expect(rows[0].type).toBe(SearchType.TOKEN);
      expect(rows[0].data.symbol).toBe('XLM');
      expect(total).toBe(1);
    });

    it('returns empty rows on database error', async () => {
      dataSource.query.mockRejectedValue(new Error('DB error'));

      const { rows } = await service.searchTokens(makeDto(), 20, 0);

      expect(rows).toHaveLength(0);
    });
  });

  // ── searchGlobal() ────────────────────────────────────────────────────────

  describe('searchGlobal()', () => {
    it('merges results from all types sorted by rank', async () => {
      dataSource.query
        .mockResolvedValueOnce([mockUser])        // users rows  (rank 0.5)
        .mockResolvedValueOnce([{ total: '1' }])  // users count
        .mockResolvedValueOnce([mockGroup])        // groups rows (rank 0.4)
        .mockResolvedValueOnce([{ total: '1' }])  // groups count
        .mockResolvedValueOnce([mockMessage])      // messages rows (rank 0.3)
        .mockResolvedValueOnce([{ total: '1' }])  // messages count
        .mockResolvedValueOnce([mockToken])        // tokens rows (rank 0.6)
        .mockResolvedValueOnce([{ total: '1' }]); // tokens count

      const result = await service.searchGlobal(makeDto());

      expect(result.results).toHaveLength(4);
      // Should be sorted by rank desc: token(0.6) > user(0.5) > group(0.4) > message(0.3)
      expect(result.results[0].type).toBe(SearchType.TOKEN);
      expect(result.results[1].type).toBe(SearchType.USER);
      expect(result.results[2].type).toBe(SearchType.GROUP);
      expect(result.results[3].type).toBe(SearchType.MESSAGE);
    });

    it('returns total as sum of all type counts', async () => {
      dataSource.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: '10' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: '5' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: '15' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: '2' }]);

      const result = await service.searchGlobal(makeDto());

      expect(result.total).toBe(32);
    });

    it('handles cursor-based pagination', async () => {
      const cursor = Buffer.from('2').toString('base64url');
      dataSource.query
        .mockResolvedValueOnce([mockUser, mockUser, mockUser, mockUser])
        .mockResolvedValueOnce([{ total: '4' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: '0' }]);

      const result = await service.searchGlobal(makeDto({ limit: 2, cursor }));

      // offset=2, so we skip first 2 results from the merged 4
      expect(result.results).toHaveLength(2);
    });
  });

  // ── Cursor helpers ────────────────────────────────────────────────────────

  describe('cursor encoding/decoding', () => {
    it('round-trips cursor correctly', async () => {
      cacheManager.get.mockResolvedValue(null);
      dataSource.query
        .mockResolvedValueOnce([mockUser])
        .mockResolvedValueOnce([{ total: '100' }]);

      const first = await service.search(makeDto({ type: SearchType.USER, limit: 1 }));
      expect(first.nextCursor).toBeDefined();

      cacheManager.get.mockResolvedValue(null);
      dataSource.query
        .mockResolvedValueOnce([mockUser])
        .mockResolvedValueOnce([{ total: '100' }]);

      const second = await service.search(
        makeDto({ type: SearchType.USER, limit: 1, cursor: first.nextCursor }),
      );
      expect(second.nextCursor).toBeDefined();
    });

    it('returns offset 0 for invalid cursor', async () => {
      cacheManager.get.mockResolvedValue(null);
      dataSource.query
        .mockResolvedValueOnce([mockUser])
        .mockResolvedValueOnce([{ total: '1' }]);

      // Should not throw, just use offset 0
      const result = await service.search(
        makeDto({ type: SearchType.USER, cursor: 'invalid!!!' }),
      );
      expect(result).toBeDefined();
    });
  });
});
