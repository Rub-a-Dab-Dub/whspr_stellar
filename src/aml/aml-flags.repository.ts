import { Injectable } from '@nestjs/common';
import { DataSource, Repository, MoreThan } from 'typeorm';
import { AmlFlag } from './entities/aml-flag.entity';
import { AmlFlagStatus, AmlFlagType, AmlRiskLevel } from './entities/aml.enums';

interface AmlQueryFilters {
  type?: AmlFlagType;
  status?: AmlFlagStatus;
  userId?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AmlFlagsRepository extends Repository<AmlFlag> {
  constructor(private dataSource: DataSource) {
    super(AmlFlag, dataSource.createEntityManager());
  }

  async findPaginated(filters: AmlQueryFilters): Promise<{ items: AmlFlag[]; total: number }> {
    const qb = this.createQueryBuilder('flag')
      .leftJoinAndSelect('flag.transaction', 'tx')
      .leftJoinAndSelect('flag.user', 'user');

    if (filters.type) qb.andWhere('flag.flagType = :type', { type: filters.type });
    if (filters.status) qb.andWhere('flag.status = :status', { status: filters.status });
    if (filters.userId) qb.andWhere('flag.userId = :userId', { userId: filters.userId });

    qb.orderBy('flag.createdAt', 'DESC')
      .skip(filters.page! * filters.limit!)
      .take(filters.limit!);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async getDashboardStats(): Promise<{
    totalFlags: number;
    openFlags: number;
    flagsByRisk: Record<AmlRiskLevel, number>;
    flagsByType: Record<AmlFlagType, number>;
    recentFlags: number;
  }> {
    const stats = await this.dataSource
      .createQueryBuilder()
      .select('COUNT(*)', 'totalFlags')
      .addSelect("COUNT(CASE WHEN status = 'OPEN' THEN 1 END)", 'openFlags')
      .addSelect('flagType', 'type')
      .addSelect('COUNT(*)', 'count')
      .from(AmlFlag, 'flag')
      .groupBy('flagType')
      .getRawMany();

    // Recent flags (24h)
    const recent = await this.count({
      where: { createdAt: MoreThan(new Date(Date.now() - 24 * 60 * 60 * 1000)) },
    });

    // Transform to records (simplified)
    const flagsByType: Record<AmlFlagType, number> = {} as any;
    stats.forEach((row: any) => {
      flagsByType[row.type as AmlFlagType] = parseInt(row.count);
    });

    return {
      totalFlags: await this.count(),
      openFlags: await this.count({ where: { status: AmlFlagStatus.OPEN } }),
      flagsByRisk: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }, // TODO: query
      flagsByType,
      recentFlags: recent,
    };
  }

  async findByUserRecent(userId: string, limit = 10): Promise<AmlFlag[]> {
    return this.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async countByTypeStatus(type?: AmlFlagType, status?: AmlFlagStatus): Promise<number> {
    const where: any = {};
    if (type) where.flagType = type;
    if (status) where.status = status;
    return this.count({ where });
  }
}

