import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Room, RoomType } from './entities/room.entity';
import { RoomMember, RoomMemberRole } from './entities/room-member.entity';
import { RoomBlockchainService } from './services/room-blockchain.service';
import { PaymentInstructionsDto } from './dto/join-room.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { GetRoomsDto } from './dto/get-rooms.dto';
import { SearchRoomsDto } from './dto/search-rooms.dto';
import { DiscoverRoomsDto } from './dto/discover-rooms.dto';
import { UserService } from '../user/user.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { EventType } from '../analytics/entities/analytics-event.entity';

// ─── Cursor helpers ───────────────────────────────────────────────────────────

function encodeCursor(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function decodeCursor(cursor: string): Record<string, unknown> | null {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private roomRepository: Repository<Room>,
    @InjectRepository(RoomMember)
    private roomMemberRepository: Repository<RoomMember>,
    private roomBlockchainService: RoomBlockchainService,
    private configService: ConfigService,
    private userService: UserService,
    private dataSource: DataSource,
    private analyticsService: AnalyticsService,
  ) {}

  // ─── Create ─────────────────────────────────────────────────────────────────

  async createRoom(
    createRoomDto: CreateRoomDto,
    creatorId: string,
    creatorWalletAddress?: string,
  ): Promise<Room> {
    if (
      createRoomDto.type === RoomType.TOKEN_GATED &&
      (!createRoomDto.entryFee || !createRoomDto.tokenAddress)
    ) {
      throw new BadRequestException(
        'Token-gated rooms require entryFee and tokenAddress',
      );
    }
    if (createRoomDto.type === RoomType.TIMED && !createRoomDto.expiresAt) {
      throw new BadRequestException('Timed rooms require expiresAt');
    }
    if (createRoomDto.tags && createRoomDto.tags.length > 5) {
      throw new BadRequestException('A room can have at most 5 tags');
    }

    const room = this.roomRepository.create({
      ...createRoomDto,
      creatorId,
      creatorWalletAddress,
      maxMembers: createRoomDto.maxMembers || 100,
      expiresAt: createRoomDto.expiresAt
        ? new Date(createRoomDto.expiresAt)
        : null,
    } as any);

    const savedRoom = await this.roomRepository.save(room);
    await this.userService.addXP(creatorId, 50);

    // Track room creation
    await this.analyticsService.track(creatorId, EventType.ROOM_CREATED, {
      roomId: savedRoom.id,
      roomType: savedRoom.type,
      isPrivate: savedRoom.isPrivate,
    });

    return savedRoom;
  }

  // ─── List / Paginate ─────────────────────────────────────────────────────────

  async getRooms(
    getRoomsDto: GetRoomsDto,
  ): Promise<{ rooms: Room[]; total: number }> {
    const { page = 1, limit = 10 } = getRoomsDto;
    const skip = (page - 1) * limit;

    const [rooms, total] = await this.roomRepository.findAndCount({
      where: { type: RoomType.PUBLIC, isActive: true, expiresAt: require('typeorm').IsNull() },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { rooms, total };
  }

  // ─── Discover (trending) ─────────────────────────────────────────────────────

  /**
   * Returns active rooms sorted by trendingScore DESC.
   * Cursor encodes { trendingScore, id } for stable keyset pagination.
   * Each room in the response includes memberCount and messageCount24h.
   */
  async getTrendingRooms(dto: DiscoverRoomsDto): Promise<{
    rooms: (Room & { memberCount: number; messageCount24h: number })[];
    nextCursor: string | null;
  }> {
    const limit = Math.min(dto.limit ?? 20, 100);
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    let cursorScore: number | null = null;
    let cursorId: string | null = null;
    if (dto.cursor) {
      const decoded = decodeCursor(dto.cursor);
      if (decoded) {
        cursorScore = decoded.trendingScore as number;
        cursorId = decoded.id as string;
      }
    }

    const qb = this.dataSource
      .createQueryBuilder(Room, 'room')
      .where('room.is_active = :active', { active: true })
      .addSelect(
        (sub) =>
          sub
            .select('COUNT(rm.id)', 'memberCount')
            .from(RoomMember, 'rm')
            .where('rm.room_id = room.id'),
        'memberCount',
      )
      .addSelect(
        (sub) =>
          sub
            .select('COUNT(m.id)', 'messageCount24h')
            .from('messages', 'm')
            .where('m.room_id = room.id')
            .andWhere('m.created_at >= :since24h', { since24h }),
        'messageCount24h',
      )
      .orderBy('room.trending_score', 'DESC')
      .addOrderBy('room.id', 'ASC')
      .limit(limit + 1);

    if (cursorScore !== null && cursorId !== null) {
      qb.andWhere(
        '(room.trending_score < :cursorScore OR (room.trending_score = :cursorScore AND room.id > :cursorId))',
        { cursorScore, cursorId },
      );
    }

    const raw = await qb.getRawAndEntities();

    const rooms = raw.entities.map((room, idx) => {
      const rawRow = raw.raw[idx];
      return Object.assign(room, {
        memberCount: parseInt(rawRow['memberCount'] ?? '0', 10),
        messageCount24h: parseInt(rawRow['messageCount24h'] ?? '0', 10),
        trendingScore: parseFloat(String(room.trendingScore ?? 0)),
      });
    }) as (Room & { memberCount: number; messageCount24h: number })[];

    let nextCursor: string | null = null;
    if (rooms.length > limit) {
      rooms.splice(limit);
      const last = rooms[rooms.length - 1];
      nextCursor = encodeCursor({
        trendingScore: last.trendingScore,
        id: last.id,
      });
    }

    return { rooms, nextCursor };
  }

  // ─── Search ──────────────────────────────────────────────────────────────────

  /**
   * Filtered room search.
   *  - q:      ILIKE on name + description
   *  - tags:   OR-based ILIKE match against the simple-array column
   *  - minFee / maxFee: entry fee numeric range
   *  - chain:  exact match
   *  - cursor: keyset pagination by createdAt DESC, id ASC
   */
  async searchRooms(dto: SearchRoomsDto): Promise<{
    rooms: (Room & { memberCount: number; messageCount24h: number })[];
    nextCursor: string | null;
  }> {
    const limit = Math.min(dto.limit ?? 20, 100);
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    let cursorCreatedAt: Date | null = null;
    let cursorId: string | null = null;
    if (dto.cursor) {
      const decoded = decodeCursor(dto.cursor);
      if (decoded) {
        cursorCreatedAt = new Date(decoded.createdAt as string);
        cursorId = decoded.id as string;
      }
    }

    const qb = this.dataSource
      .createQueryBuilder(Room, 'room')
      .where('room.is_active = :active', { active: true })
      .addSelect(
        (sub) =>
          sub
            .select('COUNT(rm.id)', 'memberCount')
            .from(RoomMember, 'rm')
            .where('rm.room_id = room.id'),
        'memberCount',
      )
      .addSelect(
        (sub) =>
          sub
            .select('COUNT(m.id)', 'messageCount24h')
            .from('messages', 'm')
            .where('m.room_id = room.id')
            .andWhere('m.created_at >= :since24h', { since24h }),
        'messageCount24h',
      )
      .orderBy('room.created_at', 'DESC')
      .addOrderBy('room.id', 'ASC')
      .limit(limit + 1);

    if (dto.q) {
      qb.andWhere('(room.name ILIKE :q OR room.description ILIKE :q)', {
        q: `%${dto.q}%`,
      });
    }

    if (dto.tags && dto.tags.length > 0) {
      const tagConditions = dto.tags.map((tag, i) => {
        qb.setParameter(`tag${i}`, `%${tag}%`);
        return `room.tags ILIKE :tag${i}`;
      });
      qb.andWhere(`(${tagConditions.join(' OR ')})`);
    }

    if (dto.minFee !== undefined) {
      qb.andWhere('CAST(room.entry_fee AS NUMERIC) >= :minFee', {
        minFee: dto.minFee,
      });
    }
    if (dto.maxFee !== undefined) {
      qb.andWhere('CAST(room.entry_fee AS NUMERIC) <= :maxFee', {
        maxFee: dto.maxFee,
      });
    }

    if (dto.chain) {
      qb.andWhere('room.chain = :chain', { chain: dto.chain });
    }

    if (cursorCreatedAt !== null && cursorId !== null) {
      qb.andWhere(
        '(room.created_at < :cursorCreatedAt OR (room.created_at = :cursorCreatedAt AND room.id > :cursorId))',
        { cursorCreatedAt, cursorId },
      );
    }

    const raw = await qb.getRawAndEntities();

    const rooms = raw.entities.map((room, idx) => {
      const rawRow = raw.raw[idx];
      return Object.assign(room, {
        memberCount: parseInt(rawRow['memberCount'] ?? '0', 10),
        messageCount24h: parseInt(rawRow['messageCount24h'] ?? '0', 10),
        trendingScore: parseFloat(String(room.trendingScore ?? 0)),
      });
    }) as (Room & { memberCount: number; messageCount24h: number })[];

    let nextCursor: string | null = null;
    if (rooms.length > limit) {
      rooms.splice(limit);
      const last = rooms[rooms.length - 1];
      nextCursor = encodeCursor({
        createdAt: last.createdAt.toISOString(),
        id: last.id,
      });
    }

    return { rooms, nextCursor };
  }

  // ─── CRUD helpers ─────────────────────────────────────────────────────────────

  async getRoomById(id: string): Promise<Room> {
    const room = await this.roomRepository.findOne({ where: { id } });
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    return room;
  }

  async findOne(id: string): Promise<Room> {
    return this.getRoomById(id);
  }

  async findByCreator(creatorId: string): Promise<Room[]> {
    return this.roomRepository.find({ where: { creatorId } });
  }

  async getTotalMemberCount(roomIds: string[]): Promise<number> {
    if (roomIds.length === 0) return 0;
    
    const result = await this.roomMemberRepository
      .createQueryBuilder('member')
      .select('COUNT(DISTINCT member.userId)', 'count')
      .where('member.roomId IN (:...roomIds)', { roomIds })
      .getRawOne();
    
    return parseInt(result.count || '0');
  }

  async updateRoom(
    id: string,
    updateRoomDto: UpdateRoomDto,
    userId: string,
  ): Promise<Room> {
    const room = await this.getRoomById(id);

    if (room.creatorId !== userId) {
      throw new ForbiddenException('Only room creator can update the room');
    }

    Object.assign(room, {
      ...updateRoomDto,
      expiresAt: updateRoomDto.expiresAt
        ? new Date(updateRoomDto.expiresAt)
        : room.expiresAt,
    });

    return this.roomRepository.save(room);
  }

  async deleteRoom(
    id: string,
    userId: string,
    isAdmin: boolean = false,
  ): Promise<void> {
    const room = await this.getRoomById(id);

    if (!isAdmin && room.creatorId !== userId) {
      throw new ForbiddenException(
        'Only room creator or admin can delete the room',
      );
    }

    room.isActive = false;
    await this.roomRepository.save(room);
  }

  // ─── Join flow ───────────────────────────────────────────────────────────────

  async initiateJoin(
    roomId: string,
    userId: string,
    userWalletAddress: string,
  ): Promise<PaymentInstructionsDto | { success: boolean }> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const existingMember = await this.roomMemberRepository.findOne({
      where: { roomId, userId },
    });
    if (existingMember) {
      if (existingMember.isBanned) {
        throw new ForbiddenException('User is banned from this room');
      }
      throw new ConflictException('User is already a member of this room');
    }

    if (room.type === RoomType.PUBLIC) {
      await this.roomMemberRepository.save({
        roomId,
        userId,
        transactionHash: null,
        paidAmount: null,
      });
      return { success: true };
    }

    if (room.type === RoomType.TOKEN_GATED) {
      return {
        contractAddress:
          this.configService.get('PAYMENT_CONTRACT_ADDRESS') || 'GCEXAMPLE',
        amount: room.entryFee,
        tokenAddress: room.tokenAddress || 'native',
        recipientAddress: room.creatorWalletAddress,
      };
    }

    throw new BadRequestException('Invalid room type');
  }

  async confirmJoin(
    roomId: string,
    userId: string,
    transactionHash: string,
  ): Promise<{ success: boolean; error?: string }> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    if (room.type !== RoomType.TOKEN_GATED) {
      throw new BadRequestException('Room is not token-gated');
    }

    const existingMember = await this.roomMemberRepository.findOne({
      where: { transactionHash },
    });
    if (existingMember) {
      throw new ConflictException('Transaction hash already used');
    }

    const verification = await this.roomBlockchainService.verifyTransaction(
      transactionHash,
      room.entryFee,
      room.creatorWalletAddress,
    );

    if (!verification.isValid) {
      return { success: false, error: verification.error };
    }

    const treasuryWallet =
      this.configService.get('TREASURY_WALLET_ADDRESS') || 'GTREASURY';
    const feeDistribution = await this.roomBlockchainService.distributeFees(
      room.entryFee,
      room.creatorWalletAddress,
      treasuryWallet,
    );

    if (!feeDistribution.success) {
      return { success: false, error: feeDistribution.error };
    }

    await this.roomMemberRepository.save({
      roomId,
      userId,
      transactionHash,
      paidAmount: room.entryFee,
    });

    // Track room join
    await this.analyticsService.track(userId, EventType.ROOM_JOINED, {
      roomId,
      roomType: room.type,
      paidAmount: room.entryFee,
    });

    return { success: true };
  }
}
