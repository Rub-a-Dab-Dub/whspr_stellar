import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { User } from '../user/entities/user.entity';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { MessageMedia } from '../messages/entities/message-media.entity';
import { StatsQueryDto, TimePeriod } from './dto/stats-query.dto';

@Injectable()
export class AdminStatsService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Payment)
    private paymentRepo: Repository<Payment>,
    @InjectRepository(MessageMedia)
    private messageRepo: Repository<MessageMedia>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async getOverview() {
    const cacheKey = 'admin:stats:overview';
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalUsers, dau, mau, totalRooms, transactions24h] = await Promise.all([
      this.userRepo.count(),
      this.userRepo.count({ where: { updatedAt: Between(oneDayAgo, now) } }),
      this.userRepo.count({ where: { updatedAt: Between(thirtyDaysAgo, now) } }),
      this.messageRepo.createQueryBuilder('m').select('COUNT(DISTINCT m.roomId)', 'count').where('m.roomId IS NOT NULL').getRawOne().then(r => parseInt(r.count)),
      this.paymentRepo.count({ where: { status: PaymentStatus.COMPLETED, createdAt: Between(oneDayAgo, now) } }),
    ]);

    const result = { totalUsers, dau, mau, totalRooms, transactions24h };
    await this.cacheManager.set(cacheKey, result, 300);
    return result;
  }

  async getUserStats(query: StatsQueryDto) {
    const cacheKey = `admin:stats:users:${JSON.stringify(query)}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const { startDate, endDate, page = 1, limit = 30 } = query;
    const start = startDate ? new Date(startDate) : this.getStartDate(query.period);
    const end = endDate ? new Date(endDate) : new Date();

    const qb = this.userRepo.createQueryBuilder('u')
      .select("DATE(u.createdAt)", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('u.createdAt BETWEEN :start AND :end', { start, end })
      .groupBy('DATE(u.createdAt)')
      .orderBy('date', 'ASC')
      .offset((page - 1) * limit)
      .limit(limit);

    const data = await qb.getRawMany();
    const total = await this.userRepo.count({ where: { createdAt: Between(start, end) } });

    const result = { data, total, page, limit };
    await this.cacheManager.set(cacheKey, result, 300);
    return result;
  }

  async getMessageStats(query: StatsQueryDto) {
    const cacheKey = `admin:stats:messages:${JSON.stringify(query)}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const { startDate, endDate, page = 1, limit = 30 } = query;
    const start = startDate ? new Date(startDate) : this.getStartDate(query.period);
    const end = endDate ? new Date(endDate) : new Date();

    const qb = this.messageRepo.createQueryBuilder('m')
      .select("DATE(m.createdAt)", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('m.createdAt BETWEEN :start AND :end', { start, end })
      .groupBy('DATE(m.createdAt)')
      .orderBy('date', 'ASC')
      .offset((page - 1) * limit)
      .limit(limit);

    const data = await qb.getRawMany();
    const total = await this.messageRepo.count({ where: { createdAt: Between(start, end) } });

    const result = { data, total, page, limit };
    await this.cacheManager.set(cacheKey, result, 300);
    return result;
  }

  async getPaymentStats(query: StatsQueryDto) {
    const cacheKey = `admin:stats:payments:${JSON.stringify(query)}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const { startDate, endDate, page = 1, limit = 30 } = query;
    const start = startDate ? new Date(startDate) : this.getStartDate(query.period);
    const end = endDate ? new Date(endDate) : new Date();

    const qb = this.paymentRepo.createQueryBuilder('p')
      .select("DATE(p.createdAt)", 'date')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(CAST(p.amount AS DECIMAL))', 'volume')
      .addSelect('SUM(CAST(p.amount AS DECIMAL)) * 0.02', 'fees')
      .where('p.status = :status', { status: PaymentStatus.COMPLETED })
      .andWhere('p.createdAt BETWEEN :start AND :end', { start, end })
      .groupBy('DATE(p.createdAt)')
      .orderBy('date', 'ASC')
      .offset((page - 1) * limit)
      .limit(limit);

    const data = await qb.getRawMany();
    const total = await this.paymentRepo.count({ 
      where: { status: PaymentStatus.COMPLETED, createdAt: Between(start, end) } 
    });

    const result = { data, total, page, limit };
    await this.cacheManager.set(cacheKey, result, 300);
    return result;
  }

  async getRoomStats() {
    const cacheKey = 'admin:stats:rooms';
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [activeRooms, newRooms] = await Promise.all([
      this.messageRepo.createQueryBuilder('m')
        .select('COUNT(DISTINCT m.roomId)', 'count')
        .where('m.roomId IS NOT NULL')
        .andWhere('m.createdAt >= :oneDayAgo', { oneDayAgo })
        .getRawOne()
        .then(r => parseInt(r.count)),
      this.messageRepo.createQueryBuilder('m')
        .select('COUNT(DISTINCT m.roomId)', 'count')
        .where('m.roomId IS NOT NULL')
        .andWhere('m.createdAt >= :oneDayAgo', { oneDayAgo })
        .getRawOne()
        .then(r => parseInt(r.count)),
    ]);

    const result = { activeRooms, newRooms, expiredRooms: 0 };
    await this.cacheManager.set(cacheKey, result, 300);
    return result;
  }

  private getStartDate(period: TimePeriod = TimePeriod.MONTH): Date {
    const now = new Date();
    switch (period) {
      case TimePeriod.DAY:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case TimePeriod.WEEK:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case TimePeriod.MONTH:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case TimePeriod.YEAR:
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }
}
