import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { PortfolioSnapshot } from './entities/portfolio-snapshot.entity';

export interface PaginatedSnapshots {
  items: PortfolioSnapshot[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class PortfolioSnapshotRepository {
  private readonly logger = new Logger(PortfolioSnapshotRepository.name);

  constructor(
    @InjectRepository(PortfolioSnapshot)
    private readonly repo: Repository<PortfolioSnapshot>,
  ) {}

  async createAndSave(createData: Partial<PortfolioSnapshot>): Promise<PortfolioSnapshot> {
    const entity = this.repo.create(createData);
    return this.repo.save(entity);
  }

  async findLatestByUserId(userId: string, days: number): Promise<PortfolioSnapshot | null> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return this.repo.findOne({
      where: { userId, snapshotDate: { $gte: cutoff } },
      order: { snapshotDate: 'DESC' },
    });
  }

  async findHistoryByUserId(
    userId: string,
    from?: Date,
    to?: Date,
    limit: number = 100,
    page: number = 1,
  ): Promise<PaginatedSnapshots> {
    const qb = this.repo.createQueryBuilder('ps')
      .where('ps.userId = :userId', { userId })
      .orderBy('ps.snapshotDate', 'DESC');

    if (from) qb.andWhere('ps.snapshotDate >= :from', { from });
    if (to) qb.andWhere('ps.snapshotDate <= :to', { to });

    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async deleteOldSnapshots(userId: string, keepDays: number = 365): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - keepDays);
    await this.repo.delete({ userId, snapshotDate: LessThan(cutoff) });
  }
}

