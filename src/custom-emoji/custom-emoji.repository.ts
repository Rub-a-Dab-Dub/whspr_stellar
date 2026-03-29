import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { CustomEmoji } from './entities/custom-emoji.entity';

@Injectable()
export class CustomEmojiRepository extends Repository<CustomEmoji> {
  constructor(private readonly dataSource: DataSource) {
    super(CustomEmoji, dataSource.createEntityManager());
  }

  findByGroup(groupId: string): Promise<CustomEmoji[]> {
    return this.find({
      where: { groupId, isActive: true },
      order: { name: 'ASC' },
    });
  }

  findByGroupAndName(groupId: string, name: string): Promise<CustomEmoji | null> {
    return this.findOne({ where: { groupId, name, isActive: true } });
  }

  countByGroup(groupId: string): Promise<number> {
    return this.count({ where: { groupId, isActive: true } });
  }

  searchByName(query: string, groupId?: string, page = 1, limit = 20): Promise<[CustomEmoji[], number]> {
    const qb = this.createQueryBuilder('emoji')
      .where('emoji.name ILIKE :query', { query: `%${query}%` })
      .andWhere('emoji.isActive = true');

    if (groupId) {
      qb.andWhere('emoji.groupId = :groupId', { groupId });
    }

    return qb
      .orderBy('emoji.usageCount', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
  }

  async incrementUsage(id: string): Promise<void> {
    await this.increment({ id }, 'usageCount', 1);
  }
}
