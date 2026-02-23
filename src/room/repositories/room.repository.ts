import { Injectable } from '@nestjs/common';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { Room, RoomType } from '../entities/room.entity';
import { RoomSortBy } from '../dto/room-search.dto';

export interface RoomSearchFilters {
  q?: string;
  roomType?: RoomType;
  category?: string;
  tags?: string[];
  minMembers?: number;
  maxMembers?: number;
  hasEntryFee?: boolean;
  sortBy?: RoomSortBy;
  page?: number;
  limit?: number;
}

@Injectable()
export class RoomRepository extends Repository<Room> {
  constructor(private dataSource: DataSource) {
    super(Room, dataSource.createEntityManager());
  }

  async findActiveById(roomId: string): Promise<Room | null> {
    return this.findOne({ where: { id: roomId, isDeleted: false } });
  }

  async findActiveWithOwner(roomId: string): Promise<Room | null> {
    return this.findOne({
      where: { id: roomId, isDeleted: false },
      relations: ['owner'],
    });
  }

  async isNameTaken(name: string): Promise<boolean> {
    const count = await this.count({ where: { name, isDeleted: false } });
    return count > 0;
  }

  async softDeleteRoom(roomId: string): Promise<void> {
    await this.update(roomId, {
      isDeleted: true,
      deletedAt: new Date(),
      isActive: false,
    });
  }

  // ─── Search & Discovery ────────────────────────────────────────────────────

  async searchRooms(
    filters: RoomSearchFilters,
  ): Promise<[Room[], number]> {
    const {
      q,
      roomType,
      category,
      tags,
      minMembers,
      maxMembers,
      hasEntryFee,
      sortBy = RoomSortBy.NEWEST,
      page = 1,
      limit = 20,
    } = filters;

    const qb = this.createBaseDiscoveryQuery();

    // Full-text search on name and description
    if (q && q.trim()) {
      const trimmed = q.trim();
      qb.andWhere(
        `(
          to_tsvector('english', r.name || ' ' || COALESCE(r.description, ''))
            @@ plainto_tsquery('english', :tsquery)
          OR r.name ILIKE :ilike
          OR r.description ILIKE :ilike
        )`,
        { tsquery: trimmed, ilike: `%${trimmed}%` },
      );
    }

    if (roomType) {
      qb.andWhere('r.roomType = :roomType', { roomType });
    }

    if (category) {
      qb.andWhere('r.category = :category', { category });
    }

    // Tag filtering: any room that contains all specified tags
    if (tags && tags.length > 0) {
      tags.forEach((tag, idx) => {
        qb.andWhere(`r.tags LIKE :tag${idx}`, { [`tag${idx}`]: `%${tag}%` });
      });
    }

    if (minMembers !== undefined) {
      qb.andWhere('r.memberCount >= :minMembers', { minMembers });
    }

    if (maxMembers !== undefined) {
      qb.andWhere('r.memberCount <= :maxMembers', { maxMembers });
    }

    if (hasEntryFee === true) {
      qb.andWhere('r.paymentRequired = true AND CAST(r.entry_fee AS DECIMAL) > 0');
    } else if (hasEntryFee === false) {
      qb.andWhere('(r.paymentRequired = false OR CAST(r.entry_fee AS DECIMAL) = 0)');
    }

    // Sorting
    this.applySortOrder(qb, sortBy);

    const skip = (page - 1) * limit;
    qb.skip(skip).take(limit);

    return qb.getManyAndCount();
  }

  async findTrendingRooms(limit: number): Promise<Room[]> {
    // Trending = public/active rooms scored by member count + recency
    // We pull a broader candidate set and score in memory
    const candidateLimit = Math.min(limit * 10, 200);

    const rooms = await this.createBaseDiscoveryQuery()
      .andWhere('r.createdAt >= :since', {
        since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // last 30 days
      })
      .orderBy('r.memberCount', 'DESC')
      .take(candidateLimit)
      .getMany();

    return this.scoreTrending(rooms, limit);
  }

  async findRecommendedForUser(
    userId: string,
    joinedRoomIds: string[],
    preferredCategories: string[],
    preferredTags: string[],
    limit: number,
  ): Promise<Room[]> {
    const qb = this.createBaseDiscoveryQuery();

    // Exclude rooms the user already joined
    if (joinedRoomIds.length > 0) {
      qb.andWhere('r.id NOT IN (:...joinedRoomIds)', { joinedRoomIds });
    }

    // Prefer rooms with matching category or tags
    if (preferredCategories.length > 0 || preferredTags.length > 0) {
      const conditions: string[] = [];
      if (preferredCategories.length > 0) {
        conditions.push('r.category IN (:...preferredCategories)');
        qb.setParameter('preferredCategories', preferredCategories);
      }
      if (preferredTags.length > 0) {
        preferredTags.forEach((tag, idx) => {
          conditions.push(`r.tags LIKE :recTag${idx}`);
          qb.setParameter(`recTag${idx}`, `%${tag}%`);
        });
      }
      qb.andWhere(`(${conditions.join(' OR ')})`);
    }

    return qb
      .orderBy('r.memberCount', 'DESC')
      .addOrderBy('r.createdAt', 'DESC')
      .take(limit)
      .getMany();
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  private createBaseDiscoveryQuery(): SelectQueryBuilder<Room> {
    return this.createQueryBuilder('r')
      .where('r.isDeleted = false')
      .andWhere('r.isActive = true')
      .andWhere('r.isClosed = false')
      .andWhere('r.isPrivate = false')
      .andWhere('r.roomType != :tokenGated', { tokenGated: RoomType.TOKEN_GATED });
  }

  private applySortOrder(qb: SelectQueryBuilder<Room>, sortBy: RoomSortBy): void {
    switch (sortBy) {
      case RoomSortBy.POPULAR:
        qb.orderBy('r.memberCount', 'DESC').addOrderBy('r.createdAt', 'DESC');
        break;
      case RoomSortBy.ACTIVE:
        qb.orderBy('r.memberCount', 'DESC').addOrderBy('r.updatedAt', 'DESC');
        break;
      case RoomSortBy.NEWEST:
      default:
        qb.orderBy('r.createdAt', 'DESC');
        break;
    }
  }

  private scoreTrending(rooms: Room[], limit: number): Room[] {
    if (rooms.length === 0) return [];

    const now = Date.now();
    const maxMembers = Math.max(...rooms.map((r) => r.memberCount), 1);

    const scored = rooms.map((room) => {
      const memberScore = room.memberCount / maxMembers; // 0-1

      const ageMs = now - new Date(room.createdAt).getTime();
      const ageDays = Math.max(ageMs / (1000 * 60 * 60 * 24), 0.1);
      // Recency: rooms created within 7 days get a boost; decays over time
      const recencyScore = 1 / Math.sqrt(ageDays);

      // Growth proxy: memberCount per day of existence
      const growthScore = Math.min(room.memberCount / ageDays / 10, 1);

      const score = memberScore * 0.5 + recencyScore * 0.3 + growthScore * 0.2;
      return { room, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.room);
  }
}
