import { Injectable, Logger, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { StickersRepository } from './stickers.repository';
import { StickerPacksRepository } from './sticker-packs.repository';
import { CacheService } from '../services/cache.service';
import { StickerPack } from './entities/sticker-pack.entity';
import { Sticker } from './entities/sticker.entity';
import { CreateStickerDto } from './dto/create-sticker.dto';
import { CreateStickerPackDto } from './dto/create-sticker-pack.dto';
import { StickerResponseDto } from './dto/sticker-response.dto';
import { StickerPackResponseDto } from './dto/sticker-pack-response.dto';
import { GifResultDto } from './dto/gif-result.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class StickersService {
  private readonly logger = new Logger(StickersService.name);
  private readonly tenorApiKey: string;
  private readonly tenorBaseUrl = 'https://api.tenor.com/v1';

  constructor(
    private readonly stickersRepository: StickersRepository,
    private readonly stickerPacksRepository: StickerPacksRepository,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {
    this.tenorApiKey = this.configService.get<string>('TENOR_API_KEY', '');
  }

  /**
   * Get all sticker packs with caching (10 min TTL)
   */
  async getStickerPacks(
    pagination: PaginationDto,
  ): Promise<PaginatedResponse<StickerPackResponseDto>> {
    const cacheKey = `sticker_packs:all:${pagination.page}:${pagination.limit}`;

    return this.cacheService.wrap(
      cacheKey,
      async () => {
        const [packs, total] = await this.stickerPacksRepository.findAllPacks(pagination);
        return {
          data: packs.map((pack) => this.toStickerPackResponseDto(pack)),
          total,
          page: pagination.page || 1,
          limit: pagination.limit || 10,
        };
      },
      600000, // 10 minutes
    );
  }

  /**
   * Get official sticker packs only
   */
  async getOfficialStickerPacks(
    pagination: PaginationDto,
  ): Promise<PaginatedResponse<StickerPackResponseDto>> {
    const cacheKey = `sticker_packs:official:${pagination.page}:${pagination.limit}`;

    return this.cacheService.wrap(
      cacheKey,
      async () => {
        const [packs, total] = await this.stickerPacksRepository.findOfficialPacks(pagination);
        return {
          data: packs.map((pack) => this.toStickerPackResponseDto(pack)),
          total,
          page: pagination.page || 1,
          limit: pagination.limit || 10,
        };
      },
      600000, // 10 minutes
    );
  }

  /**
   * Get sticker pack by ID with all its stickers
   */
  async getPackStickers(packId: string): Promise<StickerPackResponseDto> {
    const cacheKey = `sticker_pack:${packId}`;

    const pack = await this.cacheService.wrap(
      cacheKey,
      async () => {
        const foundPack = await this.stickerPacksRepository.findPackByIdWithStickers(packId);
        if (!foundPack) {
          throw new NotFoundException(`Sticker pack with ID ${packId} not found`);
        }
        return foundPack;
      },
      600000, // 10 minutes
    );

    return this.toStickerPackResponseDto(pack);
  }

  /**
   * Get single sticker by ID
   */
  async getSticker(stickerId: string): Promise<StickerResponseDto> {
    const sticker = await this.stickersRepository.findStickerById(stickerId);

    if (!sticker) {
      throw new NotFoundException(`Sticker with ID ${stickerId} not found`);
    }

    return plainToInstance(StickerResponseDto, sticker, {
      excludeExtraneousValues: false,
    });
  }

  /**
   * Search stickers by name and tags
   */
  async searchStickers(query: string): Promise<StickerResponseDto[]> {
    if (!query || query.trim().length === 0) {
      throw new BadRequestException('Search query cannot be empty');
    }

    const stickers = await this.stickersRepository.searchStickersByNameOrTag(query);

    return stickers.map((sticker) =>
      plainToInstance(StickerResponseDto, sticker, {
        excludeExtraneousValues: false,
      }),
    );
  }

  /**
   * Search GIFs from Tenor API with caching (5 min TTL)
   */
  async searchGIFs(q: string, limit: number = 10): Promise<GifResultDto[]> {
    if (!q || q.trim().length === 0) {
      throw new BadRequestException('GIF search query cannot be empty');
    }

    if (limit < 1 || limit > 50) {
      limit = Math.min(Math.max(limit, 1), 50);
    }

    if (!this.tenorApiKey) {
      this.logger.warn('Tenor API key not configured');
      return [];
    }

    const cacheKey = `gifs:search:${q}:${limit}`;

    try {
      return await this.cacheService.wrap(
        cacheKey,
        async () => {
          const response = await axios.get(`${this.tenorBaseUrl}/search`, {
            params: {
              q,
              key: this.tenorApiKey,
              limit,
              media_filter: 'animated_gif,webm',
            },
          });

          return this.mapTenorResultsToGifDtos(response.data.results || []);
        },
        300000, // 5 minutes
      );
    } catch (error) {
      this.logger.error(`Error searching GIFs from Tenor: ${error}`);
      return [];
    }
  }

  /**
   * Add official sticker pack to the system
   */
  async addOfficialPack(createDto: CreateStickerPackDto): Promise<StickerPackResponseDto> {
    const packData = {
      ...createDto,
      isOfficial: true,
    };

    const newPack = this.stickerPacksRepository.create(packData);
    const savedPack = await this.stickerPacksRepository.save(newPack);

    // Clear cache for all pack lists
    await this.cacheService.del(
      'sticker_packs:all:1:10',
      'sticker_packs:official:1:10',
    );

    return this.toStickerPackResponseDto(savedPack);
  }

  /**
   * Add sticker to a pack (admin only in production)
   */
  async addStickerToPack(createDto: CreateStickerDto): Promise<StickerResponseDto> {
    const pack = await this.stickerPacksRepository.findOne({
      where: { id: createDto.packId },
    });

    if (!pack) {
      throw new NotFoundException(`Sticker pack with ID ${createDto.packId} not found`);
    }

    const newSticker = this.stickersRepository.create(createDto);
    const savedSticker = await this.stickersRepository.save(newSticker);

    // Update pack's sticker count
    pack.stickerCount = (pack.stickerCount || 0) + 1;
    await this.stickerPacksRepository.save(pack);

    // Clear pack-specific cache
    await this.cacheService.del(`sticker_pack:${createDto.packId}`);

    return plainToInstance(StickerResponseDto, savedSticker, {
      excludeExtraneousValues: false,
    });
  }

  /**
   * Map Tenor API results to GifResultDto
   */
  private mapTenorResultsToGifDtos(results: any[]): GifResultDto[] {
    return results.map((result) => {
      const media = result.media[0] || {};
      return {
        id: result.id,
        title: result.title || '',
        webmUrl: media.webm?.url || '',
        mp4Url: media.mp4?.url || '',
        gifUrl: media.gif?.url || '',
        mediaUrl: media.webm?.url || media.mp4?.url || media.gif?.url || '',
        thumbnailUrl: result.media_formats?.tinygif?.url || result.thumbnail?.url || '',
      };
    });
  }

  /**
   * Convert StickerPack entity to DTO
   */
  private toStickerPackResponseDto(pack: StickerPack): StickerPackResponseDto {
    return {
      id: pack.id,
      name: pack.name,
      author: pack.author,
      isOfficial: pack.isOfficial,
      coverUrl: pack.coverUrl,
      stickerCount: pack.stickerCount,
      createdAt: pack.createdAt,
      stickers: pack.stickers
        ? pack.stickers.map((sticker) =>
            plainToInstance(StickerResponseDto, sticker, {
              excludeExtraneousValues: false,
            }),
          )
        : [],
    };
  }
}
