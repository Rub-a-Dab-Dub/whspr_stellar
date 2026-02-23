import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from '../entities/room.entity';
import { RoomMember, MemberStatus } from '../entities/room-member.entity';
import { RoomSearchAnalytics } from '../entities/room-search-analytics.entity';
import { RoomRepository } from '../repositories/room.repository';
import { RoomSearchDto, TrendingRoomsDto } from '../dto/room-search.dto';
import { CacheService } from '../../cache/cache.service';

const CACHE_TTL = {
  SEARCH: 60,          // 60 seconds
  TRENDING: 300,       // 5 minutes
  RECOMMENDED: 600,    // 10 minutes
};

@Injectable()
export class RoomSearchService {
  private readonly logger = new Logger(RoomSearchService.name);

  constructor(
    private readonly roomRepository: RoomRepository,
    @InjectRepository(RoomMember)
    private readonly memberRepository: Repository<RoomMember>,
    @InjectRepository(RoomSearchAnalytics)
    private readonly analyticsRepository: Repository<RoomSearchAnalytics>,
    private readonly cacheService: CacheService,
  ) {}

  // ─── Search ───────────────────────────────────────────────────────────────

  async search(
    dto: RoomSearchDto,
    userId: string,
  ): Promise<{ data: Room[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 20, ...filters } = dto;
    const cacheKey = this.buildSearchCacheKey(dto);

    const cached = await this.cacheService.get<{
      data: Room[];
      total: number;
      page: number;
      limit: number;
    }>(cacheKey);

    if (cached) {
      // Track analytics even on cache hit (don't await to avoid latency)
      this.trackSearch(dto.q ?? null, userId, cached.total, filters).catch(
        (err) => this.logger.error('Search analytics tracking failed', err),
      );
      return cached;
    }

    const [data, total] = await this.roomRepository.searchRooms({
      ...filters,
      page,
      limit,
    });

    const result = { data, total, page, limit };

    await this.cacheService.set(cacheKey, result, CACHE_TTL.SEARCH);

    // Track search analytics asynchronously
    this.trackSearch(dto.q ?? null, userId, total, filters).catch((err) =>
      this.logger.error('Search analytics tracking failed', err),
    );

    return result;
  }

  // ─── Trending ────────────────────────────────────────────────────────────

  async getTrending(dto: TrendingRoomsDto): Promise<Room[]> {
    const limit = dto.limit ?? 10;
    const cacheKey = `rooms:trending:${limit}`;

    return this.cacheService.wrap(
      cacheKey,
      () => this.roomRepository.findTrendingRooms(limit),
      CACHE_TTL.TRENDING,
    );
  }

  // ─── Recommended ─────────────────────────────────────────────────────────

  async getRecommended(userId: string, limit = 10): Promise<Room[]> {
    const cacheKey = `rooms:recommended:${userId}:${limit}`;

    return this.cacheService.wrap(
      cacheKey,
      () => this.computeRecommended(userId, limit),
      CACHE_TTL.RECOMMENDED,
    );
  }

  // ─── Analytics ───────────────────────────────────────────────────────────

  async getSearchAnalyticsSummary(
    since?: Date,
  ): Promise<{ totalSearches: number; topQueries: { query: string; count: number }[] }> {
    const qb = this.analyticsRepository.createQueryBuilder('sa');

    if (since) {
      qb.where('sa.createdAt >= :since', { since });
    }

    const totalSearches = await qb.getCount();

    const topQueries: { query: string; count: number }[] = await this.analyticsRepository
      .createQueryBuilder('sa')
      .select('sa.query', 'query')
      .addSelect('COUNT(*)', 'count')
      .where('sa.query IS NOT NULL')
      .andWhere('sa.query != :empty', { empty: '' })
      .groupBy('sa.query')
      .orderBy('count', 'DESC')
      .limit(20)
      .getRawMany();

    return { totalSearches, topQueries };
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private async computeRecommended(userId: string, limit: number): Promise<Room[]> {
    // Get rooms the user is already a member of
    const memberships = await this.memberRepository.find({
      where: { userId, status: MemberStatus.ACTIVE },
      relations: ['room'],
    });

    const joinedRoomIds = memberships.map((m) => m.roomId).filter(Boolean);
    const joinedRooms = memberships.map((m) => m.room).filter(Boolean);

    // Extract preferred categories and tags from joined rooms
    const preferredCategories = [
      ...new Set(
        joinedRooms
          .map((r) => r?.category)
          .filter((c): c is string => Boolean(c)),
      ),
    ];

    const preferredTags = [
      ...new Set(
        joinedRooms.flatMap((r) => r?.tags ?? []),
      ),
    ];

    const rooms = await this.roomRepository.findRecommendedForUser(
      userId,
      joinedRoomIds,
      preferredCategories,
      preferredTags.slice(0, 10), // cap to avoid too-wide queries
      limit,
    );

    // If no results from preferences, fall back to popular rooms
    if (rooms.length === 0) {
      return this.roomRepository.findTrendingRooms(limit);
    }

    return rooms;
  }

  private async trackSearch(
    query: string | null,
    userId: string,
    resultCount: number,
    filters: Partial<RoomSearchDto>,
  ): Promise<void> {
    try {
      const record = this.analyticsRepository.create({
        query: query ?? null,
        userId,
        resultCount,
        filters: Object.keys(filters).length > 0 ? (filters as Record<string, any>) : null,
      });
      await this.analyticsRepository.save(record);
    } catch (err) {
      this.logger.error('Failed to persist search analytics', err);
    }
  }

  private buildSearchCacheKey(dto: RoomSearchDto): string {
    // Sort keys deterministically so same params always produce same key
    const sortedParams = Object.entries(dto)
      .filter(([, v]) => v !== undefined && v !== null)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${Array.isArray(v) ? v.sort().join(',') : v}`)
      .join('&');
    return `rooms:search:${Buffer.from(sortedParams).toString('base64')}`;
  }
}
