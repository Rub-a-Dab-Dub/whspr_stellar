import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MessagePermission,
  RoomSettings,
} from './entities/room-setting.entity';
import { PinnedMessage } from './entities/pinned-message.entity';
import { UpdateRoomSettingsDto } from './dto/room-settings.dto';
import { RoomRepository } from './repositories/room.repository';
import { Room } from './entities/room.entity';
import { RoomMemberRepository } from './repositories/room-member.repository';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { MemberRole, MemberStatus, RoomMember } from './entities/room-member.entity';
import { ROLE_PERMISSIONS, ROOM_MEMBER_CONSTANTS } from './constants/room-member.constants';
import { RoomType } from './entities/room.entity';

@Injectable()
export class RoomSettingsService {
  // Track last message time per user per room
  private lastMessageTime = new Map<string, number>();

  constructor(
    @InjectRepository(RoomSettings)
    private settingsRepo: Repository<RoomSettings>,
    @InjectRepository(PinnedMessage)
    private pinnedRepo: Repository<PinnedMessage>,
  ) {}

  async getOrCreateSettings(roomId: string): Promise<RoomSettings> {
    let settings = await this.settingsRepo.findOne({
      where: { room: { id: roomId } },
      relations: ['room'],
    });

    if (!settings) {
      settings = this.settingsRepo.create({ room: { id: roomId } as any });
      await this.settingsRepo.save(settings);
    }

    return settings;
  }

  async updateSettings(
    roomId: string,
    dto: UpdateRoomSettingsDto,
  ): Promise<RoomSettings> {
    const settings = await this.getOrCreateSettings(roomId);
    Object.assign(settings, dto);
    return this.settingsRepo.save(settings);
  }

  async canSendMessage(
    roomId: string,
    userId: string,
    userRole: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const settings = await this.getOrCreateSettings(roomId);

    // Check read-only
    if (settings.readOnly && userRole !== 'owner') {
      return { allowed: false, reason: 'Room is in read-only mode' };
    }

    // Check message permissions
    if (
      settings.messagePermission === MessagePermission.OWNER &&
      userRole !== 'owner'
    ) {
      return { allowed: false, reason: 'Only room owner can send messages' };
    }
    if (
      settings.messagePermission === MessagePermission.ADMIN &&
      !['admin', 'owner'].includes(userRole)
    ) {
      return { allowed: false, reason: 'Only admins can send messages' };
    }

    // Check slow mode
    if (settings.slowModeSeconds > 0 && userRole !== 'owner') {
      const key = `${roomId}:${userId}`;
      const lastTime = this.lastMessageTime.get(key) || 0;
      const now = Date.now();
      const elapsed = (now - lastTime) / 1000;

      if (elapsed < settings.slowModeSeconds) {
        const remaining = Math.ceil(settings.slowModeSeconds - elapsed);
        return { allowed: false, reason: `Slow mode: wait ${remaining}s` };
      }

      this.lastMessageTime.set(key, now);
    }

    return { allowed: true };
  }

  async canPostContent(
    roomId: string,
    contentType: 'link' | 'media',
  ): Promise<boolean> {
    const settings = await this.getOrCreateSettings(roomId);
    return contentType === 'link' ? settings.allowLinks : settings.allowMedia;
  }

  async pinMessage(roomId: string, messageId: string): Promise<PinnedMessage> {
    const pinned = this.pinnedRepo.create({
      room: { id: roomId } as any,
      message: { id: messageId } as any,
    });
    return this.pinnedRepo.save(pinned);
  }

  async unpinMessage(pinnedId: string): Promise<void> {
    await this.pinnedRepo.delete(pinnedId);
  }

  async getPinnedMessages(roomId: string): Promise<PinnedMessage[]> {
    return this.pinnedRepo.find({
      where: { room: { id: roomId } },
      relations: ['message'],
      order: { pinnedAt: 'DESC' },
    });
  }
}

@Injectable()
export class RoomService {
  constructor(
    private roomRepository: RoomRepository,
    private roomMemberRepository: RoomMemberRepository,
  ) {}

  async createRoom(userId: string, dto: CreateRoomDto): Promise<Room> {
    const trimmedName = dto.name.trim();
    const roomType = this.resolveRoomType(dto);
    const { expiryTimestamp, durationMinutes } = this.resolveTiming(
      roomType,
      dto,
      true,
    );

    const room = this.roomRepository.create({
      name: trimmedName,
      description: dto.description?.trim(),
      ownerId: userId,
      creatorId: userId,
      roomType,
      isPrivate: this.resolveIsPrivate(roomType, dto.isPrivate),
      isTokenGated: dto.isTokenGated ?? roomType === RoomType.TOKEN_GATED,
      icon: dto.icon,
      maxMembers: dto.maxMembers ?? ROOM_MEMBER_CONSTANTS.DEFAULT_MAX_MEMBERS,
      isActive: dto.isActive ?? true,
      memberCount: 0,
      entryFee: dto.entryFee ?? '0',
      tokenAddress: dto.tokenAddress,
      paymentRequired: dto.paymentRequired ?? false,
      freeTrialEnabled: dto.freeTrialEnabled ?? false,
      freeTrialDurationHours: dto.freeTrialDurationHours ?? 24,
      accessDurationDays: dto.accessDurationDays,
      expiryTimestamp,
      durationMinutes,
      isExpired: false,
      warningNotificationSent: false,
      extensionCount: 0,
      isDeleted: false,
      deletedAt: undefined,
    });

    const saved = await this.roomRepository.save(room);

    const ownerMember = this.roomMemberRepository.create({
      roomId: saved.id,
      userId,
      role: MemberRole.OWNER,
      status: MemberStatus.ACTIVE,
      inviteStatus: 'ACCEPTED',
      permissions: ROLE_PERMISSIONS[MemberRole.OWNER],
      joinedAt: new Date(),
    } as RoomMember);

    await this.roomMemberRepository.save(ownerMember);
    return saved;
  }

  async getRoom(roomId: string): Promise<Room> {
    const room = await this.roomRepository.findActiveById(roomId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return room;
  }

  async updateRoom(
    roomId: string,
    userId: string,
    dto: UpdateRoomDto,
  ): Promise<Room> {
    const room = await this.roomRepository.findActiveWithOwner(roomId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    this.ensureOwner(room, userId);

    if (dto.name !== undefined) {
      room.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      room.description = dto.description?.trim();
    }
    if (dto.roomType) {
      room.roomType = dto.roomType;
      room.isPrivate = this.resolveIsPrivate(dto.roomType, dto.isPrivate);
      room.isTokenGated = dto.isTokenGated ?? dto.roomType === RoomType.TOKEN_GATED;
    }
    if (dto.isPrivate !== undefined && !dto.roomType) {
      room.isPrivate = dto.isPrivate;
    }
    if (dto.isTokenGated !== undefined && !dto.roomType) {
      room.isTokenGated = dto.isTokenGated;
    }
    if (dto.icon !== undefined) {
      room.icon = dto.icon;
    }
    if (dto.maxMembers !== undefined) {
      room.maxMembers = dto.maxMembers;
    }
    if (dto.isActive !== undefined) {
      room.isActive = dto.isActive;
    }
    if (dto.entryFee !== undefined) {
      room.entryFee = dto.entryFee;
    }
    if (dto.tokenAddress !== undefined) {
      room.tokenAddress = dto.tokenAddress;
    }
    if (dto.paymentRequired !== undefined) {
      room.paymentRequired = dto.paymentRequired;
    }
    if (dto.freeTrialEnabled !== undefined) {
      room.freeTrialEnabled = dto.freeTrialEnabled;
    }
    if (dto.freeTrialDurationHours !== undefined) {
      room.freeTrialDurationHours = dto.freeTrialDurationHours;
    }
    if (dto.accessDurationDays !== undefined) {
      room.accessDurationDays = dto.accessDurationDays;
    }

    const timing = this.resolveTiming(
      room.roomType,
      dto,
      dto.roomType === RoomType.TIMED,
    );
    if (timing.expiryTimestamp !== undefined) {
      room.expiryTimestamp = timing.expiryTimestamp;
      room.durationMinutes = timing.durationMinutes ?? room.durationMinutes;
      room.isExpired = false;
      room.warningNotificationSent = false;
    }

    return this.roomRepository.save(room);
  }

  async softDeleteRoom(roomId: string, userId: string): Promise<void> {
    const room = await this.roomRepository.findActiveWithOwner(roomId);
    if (!room) {
      throw new NotFoundException('Room not found');
    }

    this.ensureOwner(room, userId);
    await this.roomRepository.softDeleteRoom(roomId);
  }

  private resolveRoomType(dto: CreateRoomDto | UpdateRoomDto): RoomType {
    if (dto.roomType) {
      return dto.roomType;
    }
    if (dto.isPrivate) {
      return RoomType.PRIVATE;
    }

    return RoomType.PUBLIC;
  }

  private resolveIsPrivate(
    roomType: RoomType,
    isPrivate?: boolean,
  ): boolean {
    if (roomType === RoomType.PRIVATE || roomType === RoomType.TOKEN_GATED) {
      return true;
    }
    if (roomType === RoomType.PUBLIC || roomType === RoomType.TIMED) {
      return false;
    }

    return !!isPrivate;
  }

  private resolveTiming(
    roomType: RoomType,
    dto: CreateRoomDto | UpdateRoomDto,
    requireForTimed: boolean,
  ): { expiryTimestamp?: number | null; durationMinutes?: number | null } {
    if (roomType !== RoomType.TIMED) {
      return {
        expiryTimestamp: dto.expiresAt ? new Date(dto.expiresAt).getTime() : undefined,
        durationMinutes: dto.durationMinutes,
      };
    }

    if (!requireForTimed && !dto.expiresAt && !dto.durationMinutes) {
      return { expiryTimestamp: undefined, durationMinutes: undefined };
    }

    if (dto.expiresAt) {
      return {
        expiryTimestamp: new Date(dto.expiresAt).getTime(),
        durationMinutes: dto.durationMinutes,
      };
    }

    if (dto.durationMinutes) {
      return {
        expiryTimestamp: Date.now() + dto.durationMinutes * 60 * 1000,
        durationMinutes: dto.durationMinutes,
      };
    }

    throw new BadRequestException('Timed rooms require expiresAt or durationMinutes');
  }

  private ensureOwner(room: Room, userId: string): void {
    if (!room.ownerId || room.ownerId !== userId) {
      throw new ForbiddenException('Only room owner can update this room');
    }
  }
}
