import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { StickerPack } from './entities/sticker-pack.entity';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class StickerPacksRepository extends Repository<StickerPack> {
  constructor(private dataSource: DataSource) {
    super(StickerPack, dataSource.createEntityManager());
  }

  async findAllPacks(pagination: PaginationDto): Promise<[StickerPack[], number]> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    return this.findAndCount({
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: ['stickers'],
    });
  }

  async findOfficialPacks(pagination: PaginationDto): Promise<[StickerPack[], number]> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    return this.findAndCount({
      where: { isOfficial: true },
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: ['stickers'],
    });
  }

  async findPackByIdWithStickers(id: string): Promise<StickerPack | null> {
    return this.findOne({
      where: { id },
      relations: ['stickers'],
    });
  }

  async findPacksByName(name: string): Promise<StickerPack[]> {
    return this.createQueryBuilder('pack')
      .where('pack.name ILIKE :name', { name: `%${name}%` })
      .leftJoinAndSelect('pack.stickers', 'stickers')
      .orderBy('pack.createdAt', 'DESC')
      .getMany();
  }

  async searchPacksByNameAndAuthor(
    query: string,
    pagination: PaginationDto,
  ): Promise<[StickerPack[], number]> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    return this.createQueryBuilder('pack')
      .where('pack.name ILIKE :query', { query: `%${query}%` })
      .orWhere('pack.author ILIKE :query', { query: `%${query}%` })
      .leftJoinAndSelect('pack.stickers', 'stickers')
      .skip(skip)
      .take(limit)
      .orderBy('pack.createdAt', 'DESC')
      .getManyAndCount();
  }
}
