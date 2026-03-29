import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { S3StorageService } from '../attachments/storage/s3-storage.service';
import {
  ALLOWED_MIME_TYPES,
  ConfirmEmojiUploadDto,
  CustomEmojiResponseDto,
  EMOJI_NAME_REGEX,
  MAX_EMOJI_PER_GROUP,
  MAX_FILE_SIZE_BYTES,
  PRESIGN_EXPIRY_SECONDS,
  PresignEmojiResponseDto,
  PresignEmojiUploadDto,
} from './dto/custom-emoji.dto';
import { CustomEmoji } from './entities/custom-emoji.entity';
import { CustomEmojiRepository } from './custom-emoji.repository';

/** Roles that may manage custom emoji. Kept as a constant for easy extension. */
const ADMIN_ROLES = new Set(['admin', 'moderator', 'owner']);

@Injectable()
export class CustomEmojiService {
  constructor(
    private readonly repo: CustomEmojiRepository,
    private readonly storage: S3StorageService,
    private readonly config: ConfigService,
  ) {}

  // ─── Upload flow ────────────────────────────────────────────────────────────

  async generateUploadUrl(
    userId: string,
    groupId: string,
    userRole: string,
    dto: PresignEmojiUploadDto,
  ): Promise<PresignEmojiResponseDto> {
    this.assertAdminRole(userRole);
    this.validateEmojiName(dto.name);
    this.validateMimeType(dto.mimeType);

    await this.assertUniqueName(groupId, dto.name);
    await this.assertGroupCapacity(groupId);

    const fileKey = this.buildFileKey(groupId, dto.name, dto.mimeType);
    const uploadUrl = await this.storage.generateUploadUrl(fileKey, dto.mimeType, PRESIGN_EXPIRY_SECONDS);

    return { uploadUrl, fileKey, expiresIn: PRESIGN_EXPIRY_SECONDS };
  }

  async confirmUpload(
    userId: string,
    groupId: string,
    userRole: string,
    dto: ConfirmEmojiUploadDto,
  ): Promise<CustomEmojiResponseDto> {
    this.assertAdminRole(userRole);
    this.validateEmojiName(dto.name);

    // Re-check uniqueness and capacity at confirm time (race-condition guard)
    await this.assertUniqueName(groupId, dto.name);
    await this.assertGroupCapacity(groupId);

    const emoji = this.repo.create({
      groupId,
      uploadedBy: userId,
      name: dto.name,
      imageUrl: dto.imageUrl,
      fileKey: dto.fileKey,
      usageCount: 0,
      isActive: true,
    });

    const saved = await this.repo.save(emoji);
    return this.toDto(saved);
  }

  // ─── CRUD ───────────────────────────────────────────────────────────────────

  async deleteEmoji(userId: string, groupId: string, emojiId: string, userRole: string): Promise<void> {
    this.assertAdminRole(userRole);

    const emoji = await this.repo.findOne({ where: { id: emojiId, groupId } });
    if (!emoji) throw new NotFoundException('Custom emoji not found.');

    await this.storage.deleteFile(emoji.fileKey).catch(() => {
      // Storage deletion is best-effort; DB record is the source of truth
    });

    await this.repo.remove(emoji);
  }

  async getGroupEmoji(groupId: string): Promise<CustomEmojiResponseDto[]> {
    const emojis = await this.repo.findByGroup(groupId);
    return emojis.map(this.toDto);
  }

  async searchEmoji(
    query: string,
    groupId?: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: CustomEmojiResponseDto[]; total: number }> {
    if (!query.trim()) throw new BadRequestException('Search query cannot be empty.');

    const [emojis, total] = await this.repo.searchByName(query, groupId, page, limit);
    return { data: emojis.map(this.toDto), total };
  }

  async incrementUsage(emojiId: string): Promise<void> {
    await this.repo.incrementUsage(emojiId);
  }

  /**
   * Resolve :emoji_name: tokens in a message string for a given group.
   * Returns a map of token → emoji metadata for the renderer.
   */
  async resolveEmojiTokens(
    text: string,
    groupId: string,
  ): Promise<Record<string, CustomEmojiResponseDto>> {
    const tokens = [...new Set((text.match(/:([a-z0-9_]{2,32}):/g) ?? []).map((t) => t.slice(1, -1)))];
    if (tokens.length === 0) return {};

    const resolved: Record<string, CustomEmojiResponseDto> = {};
    await Promise.all(
      tokens.map(async (name) => {
        const emoji = await this.repo.findByGroupAndName(groupId, name);
        if (emoji) resolved[name] = this.toDto(emoji);
      }),
    );
    return resolved;
  }

  // ─── Validation helpers ─────────────────────────────────────────────────────

  validateEmojiName(name: string): void {
    if (!EMOJI_NAME_REGEX.test(name) || name.length < 2 || name.length > 32) {
      throw new BadRequestException(
        'Emoji name must be 2-32 lowercase alphanumeric characters or underscores.',
      );
    }
  }

  private validateMimeType(mimeType: string): void {
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new BadRequestException(`Only PNG and GIF images are allowed. Got: ${mimeType}`);
    }
  }

  private assertAdminRole(role: string): void {
    if (!ADMIN_ROLES.has(role)) {
      throw new ForbiddenException('Only group admins or moderators can manage custom emoji.');
    }
  }

  private async assertUniqueName(groupId: string, name: string): Promise<void> {
    const existing = await this.repo.findByGroupAndName(groupId, name);
    if (existing) {
      throw new BadRequestException(`An emoji named :${name}: already exists in this group.`);
    }
  }

  private async assertGroupCapacity(groupId: string): Promise<void> {
    const count = await this.repo.countByGroup(groupId);
    if (count >= MAX_EMOJI_PER_GROUP) {
      throw new BadRequestException(
        `Group has reached the maximum of ${MAX_EMOJI_PER_GROUP} custom emoji.`,
      );
    }
  }

  private buildFileKey(groupId: string, name: string, mimeType: string): string {
    const ext = mimeType === 'image/gif' ? 'gif' : 'png';
    return `emoji/${groupId}/${name}-${randomUUID()}.${ext}`;
  }

  private toDto(emoji: CustomEmoji): CustomEmojiResponseDto {
    return {
      id: emoji.id,
      groupId: emoji.groupId,
      uploadedBy: emoji.uploadedBy,
      name: emoji.name,
      imageUrl: emoji.imageUrl,
      usageCount: emoji.usageCount,
      isActive: emoji.isActive,
      createdAt: emoji.createdAt,
    };
  }
}
