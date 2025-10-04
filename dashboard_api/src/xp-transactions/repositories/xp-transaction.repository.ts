import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { XPTransaction, TransactionStatus, ActionType } from '../entities/xp-transaction.entity';
import { QueryXPTransactionDto } from '../dto/query-xp-transaction.dto';

@Injectable()
export class XPTransactionRepository extends Repository<XPTransaction> {
  constructor(private dataSource: DataSource) {
    super(XPTransaction, dataSource.createEntityManager());
  }

  async findPaginated(query: QueryXPTransactionDto) {
    const {
      page,
      limit,
      userId,
      actionType,
      startDate,
      endDate,
      minAmount,
      transactionId,
      status,
    } = query;

    const qb = this.createQueryBuilder('xp').leftJoinAndSelect('xp.user', 'user').where('1 = 1');

    if (userId) qb.andWhere('xp.userId = :userId', { userId });
    if (actionType) qb.andWhere('xp.actionType = :actionType', { actionType });
    if (startDate && endDate) {
      qb.andWhere('xp.createdAt BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });
    }
    if (minAmount) qb.andWhere('xp.finalAmount >= :minAmount', { minAmount });
    if (transactionId) qb.andWhere('xp.transactionId = :transactionId', { transactionId });
    if (status) qb.andWhere('xp.status = :status', { status });

    const [items, total] = await qb
      .orderBy('xp.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getUserTotalXP(userId: string): Promise<number> {
    const result = await this.createQueryBuilder('xp')
      .select('SUM(xp.finalAmount)', 'total')
      .where('xp.userId = :userId', { userId })
      .andWhere('xp.status = :status', { status: TransactionStatus.ACTIVE })
      .getRawOne();
    return parseInt(result?.total || '0', 10);
  }

  async getGlobalAggregates(startDate?: Date, endDate?: Date) {
    const qb = this.createQueryBuilder('xp').where('xp.status = :status', {
      status: TransactionStatus.ACTIVE,
    });

    if (startDate && endDate) {
      qb.andWhere('xp.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate });
    }

    const [totalXP, transactionCount, avgXP] = await Promise.all([
      qb.clone().select('SUM(xp.finalAmount)', 'total').getRawOne(),
      qb.clone().getCount(),
      qb.clone().select('AVG(xp.finalAmount)', 'avg').getRawOne(),
    ]);

    return {
      totalXP: parseInt(totalXP?.total || '0', 10),
      transactionCount,
      averageXP: parseFloat(avgXP?.avg || '0'),
    };
  }

  async getTopUsers(limit: number = 10) {
    const results = await this.createQueryBuilder('xp')
      .leftJoin('xp.user', 'user')
      .select('xp.userId', 'userId')
      .addSelect('user.username', 'username')
      .addSelect('SUM(xp.finalAmount)', 'totalXP')
      .where('xp.status = :status', { status: TransactionStatus.ACTIVE })
      .groupBy('xp.userId')
      .addGroupBy('user.username')
      .orderBy('totalXP', 'DESC')
      .limit(limit)
      .getRawMany();

    return results.map((r) => ({
      userId: r.userId,
      username: r.username,
      totalXP: parseInt(r.totalXP, 10),
    }));
  }

  async getDistributionByType(): Promise<Record<ActionType, number>> {
    const results = await this.createQueryBuilder('xp')
      .select('xp.actionType', 'actionType')
      .addSelect('SUM(xp.finalAmount)', 'total')
      .where('xp.status = :status', { status: TransactionStatus.ACTIVE })
      .groupBy('xp.actionType')
      .getRawMany();

    const distribution: Record<string, number> = {};
    results.forEach((r) => {
      distribution[r.actionType] = parseInt(r.total, 10);
    });
    return distribution as Record<ActionType, number>;
  }

  async getXPTimeline(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const results = await this.createQueryBuilder('xp')
      .select('DATE(xp.createdAt)', 'date')
      .addSelect('SUM(xp.finalAmount)', 'totalXP')
      .where('xp.createdAt >= :startDate', { startDate })
      .andWhere('xp.status = :status', { status: TransactionStatus.ACTIVE })
      .groupBy('DATE(xp.createdAt)')
      .orderBy('date', 'ASC')
      .getRawMany();

    return results.map((r) => ({
      date: r.date,
      totalXP: parseInt(r.totalXP, 10),
    }));
  }

  async detectSuspiciousActivity(userId: string, hours: number = 1): Promise<number> {
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hours);

    const result = await this.createQueryBuilder('xp')
      .select('SUM(xp.finalAmount)', 'total')
      .where('xp.userId = :userId', { userId })
      .andWhere('xp.createdAt >= :startTime', { startTime })
      .andWhere('xp.status = :status', { status: TransactionStatus.ACTIVE })
      .getRawOne();

    return parseInt(result?.total || '0', 10);
  }
}
