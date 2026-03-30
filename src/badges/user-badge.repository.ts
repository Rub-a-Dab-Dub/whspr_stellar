import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBadge } from './entities/user-badge.entity';

@Injectable()
export class UserBadgeRepository {
  constructor(
    @InjectRepository(UserBadge)
    private readonly repo: Repository<UserBadge>,
  ) {}

  async findByUser(userId: string): Promise<UserBadge[]> {
    return this.repo.find({
      where: { userId },
      order: { awardedAt: 'DESC' },
    });
  }

  async findByUserAndBadge(userId: string, badgeId: string): Promise<UserBadge | null> {
    return this.repo.findOne({ where: { userId, badgeId } });
  }

  async countDisplayed(userId: string): Promise<number> {
    return this.repo.count({ where: { userId, isDisplayed: true } });
  }

  async award(userId: string, badgeId: string): Promise<UserBadge | null> {
    const existing = await this.findByUserAndBadge(userId, badgeId);
    if (existing) return null; // already awarded — idempotent
    const ub = this.repo.create({ userId, badgeId, isDisplayed: false });
    return this.repo.save(ub);
  }

  async updateDisplayed(userId: string, badgeIds: string[]): Promise<void> {
    // Clear all displayed flags for user, then set the selected ones
    await this.repo.update({ userId }, { isDisplayed: false });
    if (badgeIds.length > 0) {
      await this.repo
        .createQueryBuilder()
        .update(UserBadge)
        .set({ isDisplayed: true })
        .where('userId = :userId AND badgeId IN (:...badgeIds)', { userId, badgeIds })
        .execute();
    }
  }
}
