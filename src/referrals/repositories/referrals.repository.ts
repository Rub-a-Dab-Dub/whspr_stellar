import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, EntityManager } from 'typeorm';
import { Referral, ReferralStatus } from '../entities/referral.entity';

@Injectable()
export class ReferralsRepository {
  constructor(
    @InjectRepository(Referral)
    private readonly repository: Repository<Referral>,
    private readonly dataSource: DataSource,
  ) {}

  async create(data: Partial<Referral>, manager?: EntityManager): Promise<Referral> {
    const em = manager || this.repository.manager;
    const referral = em.create(Referral, data);
    return em.save(Referral, referral);
  }

  async findByRefereeId(refereeId: string): Promise<Referral | null> {
    return this.repository.findOne({ where: { refereeId } });
  }

  async findPendingByRefereeId(refereeId: string): Promise<Referral | null> {
    return this.repository.findOne({
      where: { refereeId, status: ReferralStatus.PENDING },
      relations: ['referrer'],
    });
  }

  async findByReferrerId(referrerId: string): Promise<Referral[]> {
    return this.repository.find({
      where: { referrerId },
      order: { createdAt: 'DESC' },
      relations: ['referee'],
    });
  }

  async getLeaderboard(): Promise<any[]> {
    return this.repository
      .createQueryBuilder('referral')
      .select('referral.referrerId', 'referrerId')
      .addSelect('user.username', 'referrerUsername')
      .addSelect('COUNT(referral.id)', 'totalReferrals')
      .addSelect('SUM(referral.rewardAmount)', 'totalRewards')
      .innerJoin('referral.referrer', 'user')
      .where('referral.status = :status', { status: ReferralStatus.COMPLETED })
      .groupBy('referral.referrerId')
      .addGroupBy('user.username')
      .orderBy('COUNT(referral.id)', 'DESC')
      .addOrderBy('SUM(referral.rewardAmount)', 'DESC')
      .limit(100)
      .getRawMany();
  }

  async update(id: string, data: Partial<Referral>, manager?: EntityManager): Promise<void> {
    const em = manager || this.repository.manager;
    await em.update(Referral, { id }, data);
  }
}
