import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RoomSearchService } from './room-search.service';
import { RoomRepository } from '../repositories/room.repository';
import { RoomMember, MemberStatus } from '../entities/room-member.entity';
import { RoomSearchAnalytics } from '../entities/room-search-analytics.entity';
import { CacheService } from '../../cache/cache.service';
import { RoomSearchDto, RoomSortBy, TrendingRoomsDto } from '../dto/room-search.dto';
import { RoomType } from '../entities/room.entity';
import { RoomCategory } from '../enums/room-category.enum';

const mockRoom = (overrides = {}) => ({
  id: 'room-uuid-1',
  name: 'Test Room',
  description: 'A test room',
  roomType: RoomType.PUBLIC,
  isPrivate: false,
  isActive: true,
  isDeleted: false,
  isClosed: false,
  memberCount: 10,
  category: RoomCategory.CRYPTO,
  tags: ['defi', 'nft'],
  createdAt: new Date('2024-06-01'),
  updatedAt: new Date(),
  ...overrides,
});

describe('RoomSearchService', () => {
  let service: RoomSearchService;
  let roomRepository: any;
  let memberRepository: any;
  let analyticsRepository: any;
  let cacheService: any;

  beforeEach(async () => {
    roomRepository = {
      searchRooms: jest.fn(),
      findTrendingRooms: jest.fn(),
      findRecommendedForUser: jest.fn(),
    };
    memberRepository = {
      find: jest.fn(),
    };
    analyticsRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      }),
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockResolvedValue({}),
    };
    cacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      wrap: jest.fn().mockImplementation((_key: string, fn: () => Promise<any>) => fn()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomSearchService,
        { provide: RoomRepository, useValue: roomRepository },
        { provide: getRepositoryToken(RoomMember), useValue: memberRepository },
        { provide: getRepositoryToken(RoomSearchAnalytics), useValue: analyticsRepository },
        { provide: CacheService, useValue: cacheService },
      ],
    }).compile();

    service = module.get<RoomSearchService>(RoomSearchService);
  });

  // ─── search ───────────────────────────────────────────────────────────────

  describe('search', () => {
    it('returns rooms from repository when cache misses', async () => {
      const rooms = [mockRoom()];
      roomRepository.searchRooms.mockResolvedValue([rooms, 1]);

      const dto: RoomSearchDto = { q: 'test', page: 1, limit: 20 };
      const result = await service.search(dto, 'user-id');

      expect(result.data).toEqual(rooms);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(roomRepository.searchRooms).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'test', page: 1, limit: 20 }),
      );
    });

    it('returns cached result when cache hits', async () => {
      const cached = { data: [mockRoom()], total: 1, page: 1, limit: 20 };
      cacheService.get.mockResolvedValue(cached);

      const dto: RoomSearchDto = { q: 'cached' };
      const result = await service.search(dto, 'user-id');

      expect(result).toEqual(cached);
      expect(roomRepository.searchRooms).not.toHaveBeenCalled();
    });

    it('caches results after a fresh search', async () => {
      const rooms = [mockRoom()];
      roomRepository.searchRooms.mockResolvedValue([rooms, 1]);

      await service.search({ q: 'nft' }, 'user-id');

      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('rooms:search:'),
        expect.objectContaining({ total: 1 }),
        60,
      );
    });

    it('passes all filters to the repository', async () => {
      roomRepository.searchRooms.mockResolvedValue([[], 0]);

      const dto: RoomSearchDto = {
        q: 'defi',
        roomType: RoomType.PUBLIC,
        category: RoomCategory.CRYPTO,
        tags: ['nft'],
        minMembers: 5,
        maxMembers: 100,
        hasEntryFee: false,
        sortBy: RoomSortBy.POPULAR,
        page: 2,
        limit: 10,
      };

      await service.search(dto, 'user-id');

      expect(roomRepository.searchRooms).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'defi',
          roomType: RoomType.PUBLIC,
          category: RoomCategory.CRYPTO,
          tags: ['nft'],
          minMembers: 5,
          maxMembers: 100,
          hasEntryFee: false,
          sortBy: RoomSortBy.POPULAR,
          page: 2,
          limit: 10,
        }),
      );
    });

    it('produces the same cache key for identical query params (deterministic)', async () => {
      roomRepository.searchRooms.mockResolvedValue([[], 0]);

      await service.search({ q: 'abc', page: 1 }, 'user-id');
      await service.search({ page: 1, q: 'abc' }, 'user-id');

      const keys = (cacheService.set.mock.calls as [string, any, any][]).map(([k]) => k);
      expect(keys[0]).toEqual(keys[1]);
    });
  });

  // ─── getTrending ─────────────────────────────────────────────────────────

  describe('getTrending', () => {
    it('returns trending rooms via cache wrap', async () => {
      const trending = [mockRoom({ memberCount: 50 }), mockRoom({ memberCount: 30 })];
      cacheService.wrap.mockResolvedValue(trending);

      const dto: TrendingRoomsDto = { limit: 5 };
      const result = await service.getTrending(dto);

      expect(result).toEqual(trending);
      expect(cacheService.wrap).toHaveBeenCalledWith(
        'rooms:trending:5',
        expect.any(Function),
        300,
      );
    });

    it('uses default limit of 10', async () => {
      cacheService.wrap.mockResolvedValue([]);
      await service.getTrending({});
      expect(cacheService.wrap).toHaveBeenCalledWith('rooms:trending:10', expect.any(Function), 300);
    });
  });

  // ─── getRecommended ───────────────────────────────────────────────────────

  describe('getRecommended', () => {
    it('calls findRecommendedForUser with user preferences from joined rooms', async () => {
      const joinedRoom = mockRoom({ category: RoomCategory.GAMING, tags: ['fps'] });
      memberRepository.find.mockResolvedValue([
        { userId: 'user-1', roomId: 'room-1', status: MemberStatus.ACTIVE, room: joinedRoom },
      ]);
      roomRepository.findRecommendedForUser.mockResolvedValue([mockRoom()]);

      await service.getRecommended('user-1', 5);

      expect(roomRepository.findRecommendedForUser).toHaveBeenCalledWith(
        'user-1',
        ['room-1'],
        [RoomCategory.GAMING],
        ['fps'],
        5,
      );
    });

    it('falls back to trending rooms when user has no memberships', async () => {
      memberRepository.find.mockResolvedValue([]);
      roomRepository.findRecommendedForUser.mockResolvedValue([]);
      const trending = [mockRoom({ memberCount: 99 })];
      roomRepository.findTrendingRooms.mockResolvedValue(trending);

      const result = await service.getRecommended('new-user', 5);

      expect(result).toEqual(trending);
    });

    it('caches recommendations per user', async () => {
      memberRepository.find.mockResolvedValue([]);
      roomRepository.findRecommendedForUser.mockResolvedValue([]);
      roomRepository.findTrendingRooms.mockResolvedValue([]);

      await service.getRecommended('user-abc', 10);

      expect(cacheService.wrap).toHaveBeenCalledWith(
        'rooms:recommended:user-abc:10',
        expect.any(Function),
        600,
      );
    });
  });

  // ─── search analytics ─────────────────────────────────────────────────────

  describe('analytics tracking', () => {
    it('saves a search analytics record after a fresh search', async () => {
      roomRepository.searchRooms.mockResolvedValue([[mockRoom()], 1]);

      await service.search({ q: 'tracked-query' }, 'user-tracked');

      // Allow micro-task to flush (trackSearch is fire-and-forget)
      await new Promise((r) => setImmediate(r));

      expect(analyticsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'tracked-query', userId: 'user-tracked' }),
      );
      expect(analyticsRepository.save).toHaveBeenCalledTimes(1);
    });

    it('stores null query when no search term is provided', async () => {
      roomRepository.searchRooms.mockResolvedValue([[], 0]);
      await service.search({ roomType: RoomType.PUBLIC }, 'user-id');
      await new Promise((r) => setImmediate(r));
      expect(analyticsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ query: null }),
      );
    });
  });
});
