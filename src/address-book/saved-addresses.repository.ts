import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { SavedAddress } from './entities/saved-address.entity';

@Injectable()
export class SavedAddressesRepository extends Repository<SavedAddress> {
  constructor(private readonly dataSource: DataSource) {
    super(SavedAddress, dataSource.createEntityManager());
  }

  findByUserId(userId: string): Promise<SavedAddress[]> {
    return this.createQueryBuilder('address')
      .where('address.userId = :userId', { userId })
      .orderBy('address.lastUsedAt', 'DESC', 'NULLS LAST')
      .addOrderBy('address.createdAt', 'DESC')
      .getMany();
  }

  searchByUser(userId: string, query?: string, tag?: string): Promise<SavedAddress[]> {
    const qb = this.createQueryBuilder('address').where('address.userId = :userId', { userId });

    if (query && query.trim().length > 0) {
      const q = `%${query.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(address.alias) LIKE :q OR LOWER(address.walletAddress) LIKE :q OR EXISTS (SELECT 1 FROM unnest(address.tags) AS t WHERE LOWER(t) LIKE :q))',
        { q },
      );
    }

    if (tag && tag.trim().length > 0) {
      qb.andWhere('EXISTS (SELECT 1 FROM unnest(address.tags) AS t2 WHERE LOWER(t2) = :tag)', {
        tag: tag.trim().toLowerCase(),
      });
    }

    return qb
      .orderBy('address.lastUsedAt', 'DESC', 'NULLS LAST')
      .addOrderBy('address.createdAt', 'DESC')
      .getMany();
  }

  searchForSuggestions(userId: string, query?: string, limit = 20): Promise<SavedAddress[]> {
    const qb = this.createQueryBuilder('address').where('address.userId = :userId', { userId });

    if (query && query.trim().length > 0) {
      const q = `%${query.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(address.alias) LIKE :q OR LOWER(address.walletAddress) LIKE :q OR EXISTS (SELECT 1 FROM unnest(address.tags) AS t WHERE LOWER(t) LIKE :q))',
        { q },
      );
    }

    return qb
      .orderBy('address.usageCount', 'DESC')
      .addOrderBy('address.lastUsedAt', 'DESC', 'NULLS LAST')
      .addOrderBy('address.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  findByUserAndId(userId: string, id: string): Promise<SavedAddress | null> {
    return this.findOne({ where: { userId, id } });
  }

  findByAliasCaseInsensitive(userId: string, alias: string): Promise<SavedAddress | null> {
    return this.createQueryBuilder('address')
      .where('address.userId = :userId', { userId })
      .andWhere('LOWER(address.alias) = LOWER(:alias)', { alias })
      .getOne();
  }

  findByAddressCaseInsensitive(userId: string, walletAddress: string): Promise<SavedAddress | null> {
    return this.createQueryBuilder('address')
      .where('address.userId = :userId', { userId })
      .andWhere('LOWER(address.walletAddress) = LOWER(:walletAddress)', { walletAddress })
      .getOne();
  }
}
