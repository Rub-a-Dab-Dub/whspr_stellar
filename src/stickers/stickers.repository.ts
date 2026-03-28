import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Sticker } from './entities/sticker.entity';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class StickersRepository extends Repository<Sticker> {
  constructor(private dataSource: DataSource) {
    super(Sticker, dataSource.createEntityManager());
  }

  async findStickersByPackId(packId: string): Promise<Sticker[]> {
    return this.find({
      where: { packId },
      order: { createdAt: 'DESC' },
    });
  }

  async findStickersByPackIdPaginated(
    packId: string,
    pagination: PaginationDto,
  ): Promise<[Sticker[], number]> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    return this.findAndCount({
      where: { packId },
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });
  }

  async findStickerById(id: string): Promise<Sticker | null> {
    return this.findOne({
      where: { id },
    });
  }

  async searchStickersByName(name: string): Promise<Sticker[]> {
    return this.createQueryBuilder('sticker')
      .where('sticker.name ILIKE :name', { name: `%${name}%` })
      .leftJoinAndSelect('sticker.pack', 'pack')
      .orderBy('sticker.createdAt', 'DESC')
      .limit(50)
      .getMany();
  }

  async searchStickersByTag(tag: string): Promise<Sticker[]> {
    return this.createQueryBuilder('sticker')
      .where(':tag = ANY(sticker.tags)', { tag })
      .leftJoinAndSelect('sticker.pack', 'pack')
      .orderBy('sticker.createdAt', 'DESC')
      .limit(50)
      .getMany();
  }

  async searchStickersByNameOrTag(query: string): Promise<Sticker[]> {
    return this.createQueryBuilder('sticker')
      .where('sticker.name ILIKE :query', { query: `%${query}%` })
      .orWhere(':query = ANY(sticker.tags)', { query })
      .leftJoinAndSelect('sticker.pack', 'pack')
      .orderBy('sticker.createdAt', 'DESC')
      .limit(50)
      .getMany();
  }
}
