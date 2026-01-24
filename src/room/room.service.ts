import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MessagePermission,
  RoomSettings,
} from './entities/room-setting.entity';
import { PinnedMessage } from './entities/pinned-message.entity';
import { UpdateRoomSettingsDto } from './dto/room-settings.dto';

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
