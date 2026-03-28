import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Badge, BadgeKey } from './entities/badge.entity';

@Injectable()
export class BadgeRepository {
  constructor(
    @InjectRepository(Badge)
    private readonly repo: Repository<Badge>,
  ) {}

  async findAll(): Promise<Badge[]> {
    return this.repo.find({ order: { tier: 'ASC', name: 'ASC' } });
  }

  async findByKey(key: BadgeKey): Promise<Badge | null> {
    return this.repo.findOne({ where: { key } });
  }

  async findById(id: string): Promise<Badge | null> {
    return this.repo.findOne({ where: { id } });
  }

  async upsert(badge: Partial<Badge>): Promise<Badge> {
    const existing = await this.findByKey(badge.key!);
    if (existing) {
      Object.assign(existing, badge);
      return this.repo.save(existing);
    }
    return this.repo.save(this.repo.create(badge));
  }
}
