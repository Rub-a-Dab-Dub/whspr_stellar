import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { ModerationQueueService } from '../ai-moderation/queue/moderation.queue';
import { S3StorageService } from '../attachments/storage/s3-storage.service';
import { UserTier } from '../users/entities/user.entity';
import { UsersRepository } from '../users/users.repository';
import {
  AddUserStickerDto,
  CreateUserStickerPackDto,
  DownloadPackResponseDto,
  UserStickerPackResponseDto,
  UserStickerResponseDto,
} from './dto/user-sticker-pack.dto';
import { UserStickerPackDownload } from './entities/user-sticker-pack-download.entity';
import { UserStickerPack } from './entities/user-sticker-pack.entity';
import { UserSticker } from './entities/user-sticker.entity';
import { StickerWebpService } from './sticker-webp.service';
import {
  MAX_STICKERS_PER_UGC_PACK,
  MAX_STICKER_UPLOAD_BYTES,
  MAX_UGC_PACKS_GOLD_BLACK,
  MAX_UGC_PACKS_SILVER,
} from './user-sticker-packs.constants';

@Injectable()
export class UserStickerPackService {
  private readonly logger = new Logger(UserStickerPackService.name);

  constructor(
    @InjectRepository(UserStickerPack)
    private readonly packs: Repository<UserStickerPack>,
    @InjectRepository(UserSticker)
    private readonly stickers: Repository<UserSticker>,
    @InjectRepository(UserStickerPackDownload)
    private readonly downloads: Repository<UserStickerPackDownload>,
    private readonly usersRepository: UsersRepository,
    private readonly s3: S3StorageService,
    private readonly webp: StickerWebpService,
    private readonly moderationQueue: ModerationQueueService,
  ) {}

  private maxPacksForTier(tier: UserTier): number {
    return tier === UserTier.SILVER ? MAX_UGC_PACKS_SILVER : MAX_UGC_PACKS_GOLD_BLACK;
  }

  private async getUserTier(userId: string): Promise<UserTier> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.tier;
  }

  private assertPackOwner(pack: UserStickerPack, userId: string): void {
    if (pack.creatorId !== userId) {
      throw new ForbiddenException('You do not own this sticker pack');
    }
  }

  async createPack(creatorId: string, dto: CreateUserStickerPackDto): Promise<UserStickerPackResponseDto> {
    const tier = await this.getUserTier(creatorId);
    const count = await this.packs.count({ where: { creatorId } });
    const max = this.maxPacksForTier(tier);
    if (count >= max) {
      throw new BadRequestException(
        `Maximum of ${max} user sticker pack(s) for your tier. Upgrade to create more.`,
      );
    }

    const price = (dto.price ?? 0).toFixed(2);
    const pack = this.packs.create({
      creatorId,
      name: dto.name.trim(),
      description: dto.description?.trim() ?? null,
      coverUrl: null,
      isPublished: false,
      isApproved: false,
      downloadCount: 0,
      price,
    });
    const saved = await this.packs.save(pack);
    return this.toPackDto(saved, [], false);
  }

  async listMyPacks(creatorId: string): Promise<UserStickerPackResponseDto[]> {
    const rows = await this.packs.find({
      where: { creatorId },
      order: { createdAt: 'DESC' },
      relations: ['stickers'],
    });
    return rows.map((p) => this.toPackDto(p, p.stickers ?? [], true));
  }

  async browsePublicPacks(page = 1, limit = 20): Promise<{
    items: UserStickerPackResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const take = Math.min(Math.max(limit, 1), 50);
    const skip = (Math.max(page, 1) - 1) * take;

    const [rows, total] = await this.packs.findAndCount({
      where: { isPublished: true, isApproved: true },
      order: { downloadCount: 'DESC', createdAt: 'DESC' },
      skip,
      take,
      relations: ['stickers'],
    });

    return {
      items: rows.map((p) => this.toPackDto(p, p.stickers ?? [], true)),
      total,
      page: Math.max(page, 1),
      limit: take,
    };
  }

  /**
   * Creator always sees full pack. Others: approved+published, or downloaded approved pack.
   */
  async getPack(packId: string, viewerId: string): Promise<UserStickerPackResponseDto> {
    const pack = await this.packs.findOne({
      where: { id: packId },
      relations: ['stickers'],
    });
    if (!pack) {
      throw new NotFoundException('Sticker pack not found');
    }

    const list = [...(pack.stickers ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

    if (pack.creatorId === viewerId) {
      return this.toPackDto(pack, list, false);
    }

    if (pack.isPublished && pack.isApproved) {
      return this.toPackDto(pack, list, false);
    }

    const dl = await this.downloads.findOne({ where: { userId: viewerId, packId } });
    if (dl && pack.isApproved && pack.isPublished) {
      return this.toPackDto(pack, list, false);
    }

    throw new NotFoundException('Sticker pack not found');
  }

  async addSticker(
    packId: string,
    creatorId: string,
    dto: AddUserStickerDto,
    file?: Express.Multer.File,
  ): Promise<UserStickerResponseDto> {
    const pack = await this.packs.findOne({ where: { id: packId }, relations: ['stickers'] });
    if (!pack) {
      throw new NotFoundException('Sticker pack not found');
    }
    this.assertPackOwner(pack, creatorId);

    const n = pack.stickers?.length ?? 0;
    if (n >= MAX_STICKERS_PER_UGC_PACK) {
      throw new BadRequestException(`A pack may contain at most ${MAX_STICKERS_PER_UGC_PACK} stickers`);
    }

    let raw: Buffer;
    if (file?.buffer) {
      if (file.size > MAX_STICKER_UPLOAD_BYTES) {
        throw new BadRequestException('Sticker image too large');
      }
      raw = file.buffer;
    } else if (dto.fileKey?.trim()) {
      raw = await this.s3.getObjectBuffer(dto.fileKey.trim());
    } else {
      throw new BadRequestException('Provide a sticker file upload or fileKey from presigned upload');
    }

    const webpBuf = await this.webp.toWebp(raw);
    const fileKey = `ugc-stickers/${creatorId}/${packId}/${randomUUID()}.webp`;
    await this.s3.putObjectBuffer(fileKey, webpBuf, 'image/webp');
    const fileUrl = this.s3.resolveFileUrl(fileKey);

    const sortOrder = dto.sortOrder ?? n;
    const tags = (dto.tags ?? []).map((t) => t.trim()).filter(Boolean);

    const sticker = this.stickers.create({
      packId,
      name: dto.name.trim(),
      fileKey,
      fileUrl,
      tags,
      sortOrder,
    });
    const saved = await this.stickers.save(sticker);

    if (!pack.coverUrl) {
      pack.coverUrl = fileUrl;
      await this.packs.save(pack);
    }

    return this.toStickerDto(saved);
  }

  async removeSticker(packId: string, stickerId: string, creatorId: string): Promise<void> {
    const pack = await this.packs.findOne({ where: { id: packId }, relations: ['stickers'] });
    if (!pack) {
      throw new NotFoundException('Sticker pack not found');
    }
    this.assertPackOwner(pack, creatorId);

    const sticker = await this.stickers.findOne({ where: { id: stickerId, packId } });
    if (!sticker) {
      throw new NotFoundException('Sticker not found');
    }

    try {
      await this.s3.deleteFile(sticker.fileKey);
    } catch (e) {
      this.logger.warn(`S3 delete failed for ${sticker.fileKey}: ${e}`);
    }

    await this.stickers.remove(sticker);

    const remaining = await this.stickers.find({ where: { packId }, order: { sortOrder: 'ASC' } });
    if (remaining.length === 0) {
      pack.coverUrl = null;
    } else if (pack.coverUrl === sticker.fileUrl) {
      pack.coverUrl = remaining[0].fileUrl;
    }
    await this.packs.save(pack);
  }

  async publishPack(packId: string, creatorId: string): Promise<UserStickerPackResponseDto> {
    const pack = await this.packs.findOne({ where: { id: packId }, relations: ['stickers'] });
    if (!pack) {
      throw new NotFoundException('Sticker pack not found');
    }
    this.assertPackOwner(pack, creatorId);

    const count = pack.stickers?.length ?? 0;
    if (count < 1) {
      throw new BadRequestException('Add at least one sticker before publishing');
    }

    pack.isPublished = true;
    pack.isApproved = false;
    await this.packs.save(pack);

    await this.moderatePack(pack.id);

    const reloaded = await this.packs.findOne({
      where: { id: packId },
      relations: ['stickers'],
    });
    return this.toPackDto(reloaded!, [...(reloaded!.stickers ?? [])].sort((a, b) => a.sortOrder - b.sortOrder), false);
  }

  async unpublishPack(packId: string, creatorId: string): Promise<UserStickerPackResponseDto> {
    const pack = await this.packs.findOne({ where: { id: packId }, relations: ['stickers'] });
    if (!pack) {
      throw new NotFoundException('Sticker pack not found');
    }
    this.assertPackOwner(pack, creatorId);
    pack.isPublished = false;
    await this.packs.save(pack);
    return this.toPackDto(pack, [...(pack.stickers ?? [])].sort((a, b) => a.sortOrder - b.sortOrder), false);
  }

  /** Enqueues AI image moderation for the pack (cover or first sticker). */
  async moderatePack(packId: string): Promise<void> {
    const pack = await this.packs.findOne({ where: { id: packId }, relations: ['stickers'] });
    if (!pack) {
      return;
    }
    const imageUrl =
      pack.coverUrl ??
      (pack.stickers?.length ? [...pack.stickers].sort((a, b) => a.sortOrder - b.sortOrder)[0].fileUrl : null);
    if (!imageUrl) {
      this.logger.warn(`moderatePack(${packId}): no image URL`);
      return;
    }
    try {
      await this.moderationQueue.enqueueImageModeration(pack.id, imageUrl);
    } catch (e) {
      this.logger.warn(`Failed to enqueue sticker pack moderation: ${e}`);
    }
  }

  async downloadPack(packId: string, userId: string): Promise<DownloadPackResponseDto> {
    const pack = await this.packs.findOne({ where: { id: packId }, relations: ['stickers'] });
    if (!pack) {
      throw new NotFoundException('Sticker pack not found');
    }

    if (!pack.isPublished || !pack.isApproved) {
      throw new ForbiddenException('This pack is not available for download yet');
    }

    const priceNum = parseFloat(pack.price || '0');
    if (priceNum > 0) {
      throw new BadRequestException('Paid sticker packs are not supported yet');
    }

    if (pack.creatorId === userId) {
      return {
        success: true,
        stickersUnlocked: pack.stickers?.length ?? 0,
        message: 'You already have full access as the creator.',
      };
    }

    const existing = await this.downloads.findOne({ where: { userId, packId } });
    if (!existing) {
      await this.downloads.save(this.downloads.create({ userId, packId }));
      pack.downloadCount += 1;
      await this.packs.save(pack);
    }

    return {
      success: true,
      stickersUnlocked: pack.stickers?.length ?? 0,
      message: 'Sticker pack added to your library.',
    };
  }

  /** Stickers available in the emoji picker: own packs (any moderation) + downloaded public packs. */
  async getUserLibraryStickers(userId: string): Promise<UserStickerResponseDto[]> {
    const owned = await this.stickers
      .createQueryBuilder('s')
      .innerJoin('s.pack', 'p')
      .where('p.creatorId = :userId', { userId })
      .orderBy('s.sortOrder', 'ASC')
      .getMany();

    const downloaded = await this.stickers
      .createQueryBuilder('s')
      .innerJoin('s.pack', 'p')
      .innerJoin(UserStickerPackDownload, 'd', 'd.packId = p.id AND d.userId = :userId', { userId })
      .where('p.isApproved = true AND p.isPublished = true')
      .orderBy('s.sortOrder', 'ASC')
      .getMany();

    const byId = new Map<string, UserSticker>();
    for (const s of owned) {
      byId.set(s.id, s);
    }
    for (const s of downloaded) {
      byId.set(s.id, s);
    }

    return [...byId.values()].map((s) => this.toStickerDto(s));
  }

  async adminApprovePack(packId: string): Promise<UserStickerPackResponseDto> {
    const pack = await this.packs.findOne({ where: { id: packId }, relations: ['stickers'] });
    if (!pack) {
      throw new NotFoundException('Sticker pack not found');
    }
    pack.isApproved = true;
    await this.packs.save(pack);
    return this.toPackDto(pack, [...(pack.stickers ?? [])].sort((a, b) => a.sortOrder - b.sortOrder), true);
  }

  async adminRejectPack(packId: string): Promise<UserStickerPackResponseDto> {
    const pack = await this.packs.findOne({ where: { id: packId }, relations: ['stickers'] });
    if (!pack) {
      throw new NotFoundException('Sticker pack not found');
    }
    pack.isApproved = false;
    pack.isPublished = false;
    await this.packs.save(pack);
    return this.toPackDto(pack, [...(pack.stickers ?? [])].sort((a, b) => a.sortOrder - b.sortOrder), true);
  }

  private toStickerDto(s: UserSticker): UserStickerResponseDto {
    return {
      id: s.id,
      packId: s.packId,
      name: s.name,
      fileUrl: s.fileUrl,
      tags: s.tags ?? [],
      sortOrder: s.sortOrder,
      createdAt: s.createdAt.toISOString(),
    };
  }

  private toPackDto(
    p: UserStickerPack,
    stickers: UserSticker[],
    summaryOnly: boolean,
  ): UserStickerPackResponseDto {
    const base: UserStickerPackResponseDto = {
      id: p.id,
      creatorId: p.creatorId,
      name: p.name,
      description: p.description,
      coverUrl: p.coverUrl,
      isPublished: p.isPublished,
      isApproved: p.isApproved,
      downloadCount: p.downloadCount,
      price: String(p.price ?? '0'),
      createdAt: p.createdAt.toISOString(),
      stickerCount: stickers.length,
    };
    if (!summaryOnly) {
      base.stickers = stickers.map((s) => this.toStickerDto(s));
    }
    return base;
  }
}
