import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, IsNull } from 'typeorm';
import { UserMute } from '../entities/user-mute.entity';
import { CreateMuteDto, UpdateMuteDto } from '../dto/mute.dto';
import { MuteType } from '../enums/mute-type.enum';

@Injectable()
export class MuteService {
  private readonly logger = new Logger(MuteService.name);

  constructor(
    @InjectRepository(UserMute)
    private readonly muteRepository: Repository<UserMute>,
  ) {}

  /**
   * Create a new mute
   */
  async createMute(userId: string, createMuteDto: CreateMuteDto): Promise<UserMute> {
    const { targetType, targetId, expiresAt, reason } = createMuteDto;

    // Check if mute already exists
    const existingMute = await this.muteRepository.findOne({
      where: { userId, targetType, targetId },
    });

    if (existingMute) {
      throw new ConflictException('Mute already exists for this target');
    }

    const mute = this.muteRepository.create({
      userId,
      targetType,
      targetId,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      reason,
    });

    const savedMute = await this.muteRepository.save(mute);
    this.logger.log(`Created mute for user ${userId}: ${targetType}/${targetId}`);
    
    return savedMute;
  }

  /**
   * Get all mutes for a user
   */
  async getUserMutes(userId: string): Promise<UserMute[]> {
    const now = new Date();
    
    return this.muteRepository.find({
      where: {
        userId,
        expiresAt: IsNull() || MoreThan(now),
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get active mutes by type
   */
  async getMutesByType(userId: string, targetType: MuteType): Promise<UserMute[]> {
    const now = new Date();
    
    return this.muteRepository.find({
      where: {
        userId,
        targetType,
        expiresAt: IsNull() || MoreThan(now),
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Check if a specific target is muted
   */
  async isMuted(userId: string, targetType: MuteType, targetId: string): Promise<boolean> {
    const now = new Date();
    
    const mute = await this.muteRepository.findOne({
      where: {
        userId,
        targetType,
        targetId,
        expiresAt: IsNull() || MoreThan(now),
      },
    });

    return !!mute;
  }

  /**
   * Update an existing mute
   */
  async updateMute(userId: string, muteId: string, updateMuteDto: UpdateMuteDto): Promise<UserMute> {
    const mute = await this.muteRepository.findOne({
      where: { id: muteId, userId },
    });

    if (!mute) {
      throw new NotFoundException('Mute not found');
    }

    if (updateMuteDto.expiresAt !== undefined) {
      mute.expiresAt = updateMuteDto.expiresAt ? new Date(updateMuteDto.expiresAt) : null;
    }

    if (updateMuteDto.reason !== undefined) {
      mute.reason = updateMuteDto.reason;
    }

    const updatedMute = await this.muteRepository.save(mute);
    this.logger.log(`Updated mute ${muteId} for user ${userId}`);
    
    return updatedMute;
  }

  /**
   * Remove a mute (unmute)
   */
  async removeMute(userId: string, muteId: string): Promise<void> {
    const mute = await this.muteRepository.findOne({
      where: { id: muteId, userId },
    });

    if (!mute) {
      throw new NotFoundException('Mute not found');
    }

    await this.muteRepository.remove(mute);
    this.logger.log(`Removed mute ${muteId} for user ${userId}`);
  }

  /**
   * Remove mute by target
   */
  async unmuteTarget(userId: string, targetType: MuteType, targetId: string): Promise<void> {
    const mute = await this.muteRepository.findOne({
      where: { userId, targetType, targetId },
    });

    if (!mute) {
      throw new NotFoundException('Mute not found');
    }

    await this.muteRepository.remove(mute);
    this.logger.log(`Unmuted ${targetType}/${targetId} for user ${userId}`);
  }

  /**
   * Mute a user
   */
  async muteUser(userId: string, targetUserId: string, expiresAt?: string, reason?: string): Promise<UserMute> {
    return this.createMute(userId, {
      targetType: MuteType.USER,
      targetId: targetUserId,
      expiresAt,
      reason,
    });
  }

  /**
   * Unmute a user
   */
  async unmuteUser(userId: string, targetUserId: string): Promise<void> {
    return this.unmuteTarget(userId, MuteType.USER, targetUserId);
  }

  /**
   * Mute a room
   */
  async muteRoom(userId: string, roomId: string, expiresAt?: string, reason?: string): Promise<UserMute> {
    return this.createMute(userId, {
      targetType: MuteType.ROOM,
      targetId: roomId,
      expiresAt,
      reason,
    });
  }

  /**
   * Unmute a room
   */
  async unmuteRoom(userId: string, roomId: string): Promise<void> {
    return this.unmuteTarget(userId, MuteType.ROOM, roomId);
  }

  /**
   * Enable global mute (mute all notifications)
   */
  async enableGlobalMute(userId: string, expiresAt?: string, reason?: string): Promise<UserMute> {
    return this.createMute(userId, {
      targetType: MuteType.GLOBAL,
      targetId: 'global',
      expiresAt,
      reason,
    });
  }

  /**
   * Disable global mute
   */
  async disableGlobalMute(userId: string): Promise<void> {
    return this.unmuteTarget(userId, MuteType.GLOBAL, 'global');
  }

  /**
   * Check if user has global mute enabled
   */
  async hasGlobalMute(userId: string): Promise<boolean> {
    return this.isMuted(userId, MuteType.GLOBAL, 'global');
  }

  /**
   * Clean up expired mutes
   */
  async cleanupExpiredMutes(): Promise<number> {
    const now = new Date();
    
    const result = await this.muteRepository
      .createQueryBuilder()
      .delete()
      .from(UserMute)
      .where('expiresAt IS NOT NULL AND expiresAt <= :now', { now })
      .execute();

    const deletedCount = result.affected || 0;
    this.logger.log(`Cleaned up ${deletedCount} expired mutes`);
    
    return deletedCount;
  }

  /**
   * Get mute statistics for a user
   */
  async getMuteStats(userId: string): Promise<{
    totalMutes: number;
    userMutes: number;
    roomMutes: number;
    globalMute: boolean;
  }> {
    const mutes = await this.getUserMutes(userId);
    
    return {
      totalMutes: mutes.length,
      userMutes: mutes.filter(m => m.targetType === MuteType.USER).length,
      roomMutes: mutes.filter(m => m.targetType === MuteType.ROOM).length,
      globalMute: mutes.some(m => m.targetType === MuteType.GLOBAL),
    };
  }
}