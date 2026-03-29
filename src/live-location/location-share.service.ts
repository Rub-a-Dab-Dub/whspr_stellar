import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { ConversationParticipant } from '../conversations/entities/conversation-participant.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { User } from '../users/entities/user.entity';
import { UserTier } from '../users/entities/user.entity';
import {
  LocationShareResponseDto,
  StartLocationShareDto,
  UpdateLocationDto,
} from './dto/location-share.dto';
import { LocationShare } from './entities/location-share.entity';

const MAX_DURATION_BY_TIER: Record<UserTier, number> = {
  [UserTier.SILVER]: 60,
  [UserTier.GOLD]: 240,
  [UserTier.BLACK]: 480,
};

const THROTTLE_MS = 5_000;

@Injectable()
export class LocationShareService {
  private readonly lastUpdateMap = new Map<string, number>();

  constructor(
    @InjectRepository(LocationShare)
    private readonly repo: Repository<LocationShare>,
    @InjectRepository(Conversation)
    private readonly conversationsRepo: Repository<Conversation>,
    @InjectRepository(ConversationParticipant)
    private readonly participantsRepo: Repository<ConversationParticipant>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async startSharing(
    userId: string,
    conversationId: string,
    dto: StartLocationShareDto,
  ): Promise<LocationShare> {
    await this.assertConversationExists(conversationId);
    await this.assertParticipant(conversationId, userId);

    const user = await this.usersRepo.findOneOrFail({ where: { id: userId } });
    const maxDuration = MAX_DURATION_BY_TIER[user.tier];
    const duration = Math.min(dto.duration ?? 30, maxDuration);

    const expiresAt = new Date(Date.now() + duration * 60_000);

    // Deactivate any existing active share for this user in this conversation
    await this.repo.update(
      { userId, conversationId, isActive: true },
      { isActive: false },
    );

    const share = this.repo.create({
      userId,
      conversationId,
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracy: dto.accuracy ?? null,
      duration,
      expiresAt,
      isActive: true,
      lastUpdatedAt: new Date(),
    });

    return this.repo.save(share);
  }

  async updateLocation(
    userId: string,
    shareId: string,
    dto: UpdateLocationDto,
  ): Promise<LocationShare> {
    const share = await this.getActiveShareOrThrow(shareId);

    if (share.userId !== userId) {
      throw new ForbiddenException('Not your location share.');
    }

    const throttleKey = `${userId}:${shareId}`;
    const lastUpdate = this.lastUpdateMap.get(throttleKey) ?? 0;
    if (Date.now() - lastUpdate < THROTTLE_MS) {
      throw new BadRequestException('Location updates are throttled to once per 5 seconds.');
    }
    this.lastUpdateMap.set(throttleKey, Date.now());

    share.latitude = dto.latitude;
    share.longitude = dto.longitude;
    share.accuracy = dto.accuracy ?? null;
    share.lastUpdatedAt = new Date();

    return this.repo.save(share);
  }

  async stopSharing(userId: string, shareId: string): Promise<void> {
    const share = await this.getActiveShareOrThrow(shareId);

    if (share.userId !== userId) {
      throw new ForbiddenException('Not your location share.');
    }

    await this.repo.delete({ id: shareId });
  }

  async getActiveShares(
    userId: string,
    conversationId: string,
  ): Promise<LocationShareResponseDto[]> {
    await this.assertConversationExists(conversationId);
    await this.assertParticipant(conversationId, userId);

    const shares = await this.repo.find({
      where: { conversationId, isActive: true },
    });

    return shares.map(this.toDto);
  }

  async expireStale(): Promise<number> {
    const expired = await this.repo.find({
      where: { isActive: true, expiresAt: LessThan(new Date()) },
    });

    if (expired.length === 0) return 0;

    // Delete immediately — never persist location history beyond active session
    const ids = expired.map((s) => s.id);
    await this.repo.delete(ids);

    // Clean up throttle map entries for expired shares
    for (const share of expired) {
      this.lastUpdateMap.delete(`${share.userId}:${share.id}`);
    }

    return expired.length;
  }

  private async getActiveShareOrThrow(shareId: string): Promise<LocationShare> {
    const share = await this.repo.findOne({ where: { id: shareId, isActive: true } });
    if (!share) throw new NotFoundException('Active location share not found.');
    if (share.expiresAt <= new Date()) {
      await this.repo.delete({ id: shareId });
      throw new NotFoundException('Location share has expired.');
    }
    return share;
  }

  private async assertConversationExists(conversationId: string): Promise<void> {
    const exists = await this.conversationsRepo.exist({ where: { id: conversationId } });
    if (!exists) throw new NotFoundException('Conversation not found.');
  }

  private async assertParticipant(conversationId: string, userId: string): Promise<void> {
    const isParticipant = await this.participantsRepo.exist({
      where: { conversationId, userId },
    });
    if (!isParticipant) throw new ForbiddenException('Not a participant in this conversation.');
  }

  private toDto(share: LocationShare): LocationShareResponseDto {
    return {
      id: share.id,
      userId: share.userId,
      conversationId: share.conversationId,
      latitude: Number(share.latitude),
      longitude: Number(share.longitude),
      accuracy: share.accuracy !== null ? Number(share.accuracy) : null,
      duration: share.duration,
      expiresAt: share.expiresAt,
      isActive: share.isActive,
      lastUpdatedAt: share.lastUpdatedAt,
      createdAt: share.createdAt,
    };
  }
}
