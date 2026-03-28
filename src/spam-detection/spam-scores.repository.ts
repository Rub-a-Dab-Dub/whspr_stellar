import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { SpamScore, SpamActionType } from './entities/spam-score.entity';

@Injectable()
export class SpamScoresRepository extends Repository<SpamScore> {
  constructor(private dataSource: DataSource) {
    super(SpamScore, dataSource.createEntityManager());
  }

  async findByUserId(userId: string): Promise<SpamScore | null> {
    return this.findOne({
      where: { userId },
      relations: ['user'],
    });
  }

  async findHighScoreUsers(threshold: number, limit: number = 50): Promise<SpamScore[]> {
    return this.find({
      where: {
        score: threshold as any, // TypeORM doesn't have native > operator in where
      },
      order: { score: 'DESC' },
      take: limit,
      relations: ['user'],
    });
  }

  async findHighScoreUsersQuery(threshold: number, limit: number = 50): Promise<SpamScore[]> {
    return this.createQueryBuilder('spam')
      .leftJoinAndSelect('spam.user', 'user')
      .where('spam.score > :threshold', { threshold })
      .orderBy('spam.score', 'DESC')
      .take(limit)
      .getMany();
  }

  async findByAction(action: SpamActionType, limit: number = 50): Promise<SpamScore[]> {
    return this.find({
      where: { action },
      order: { triggeredAt: 'DESC' },
      take: limit,
      relations: ['user'],
    });
  }

  async findPendingReview(limit: number = 50): Promise<SpamScore[]> {
    return this.createQueryBuilder('spam')
      .leftJoinAndSelect('spam.user', 'user')
      .where('spam.action != :action', { action: SpamActionType.NONE })
      .andWhere('spam.reviewedAt IS NULL')
      .orderBy('spam.score', 'DESC')
      .orderBy('spam.triggeredAt', 'ASC')
      .take(limit)
      .getMany();
  }

  async findRecentWithHighScores(days: number, threshold: number, limit: number = 100): Promise<SpamScore[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.createQueryBuilder('spam')
      .leftJoinAndSelect('spam.user', 'user')
      .where('spam.createdAt >= :startDate', { startDate })
      .andWhere('spam.score >= :threshold', { threshold })
      .orderBy('spam.score', 'DESC')
      .orderBy('spam.createdAt', 'DESC')
      .take(limit)
      .getMany();
  }

  async countByAction(action: SpamActionType): Promise<number> {
    return this.count({ where: { action } });
  }

  async countAboveThreshold(threshold: number): Promise<number> {
    return this.createQueryBuilder('spam')
      .where('spam.score > :threshold', { threshold })
      .getCount();
  }

  async getAverageScore(): Promise<number> {
    const result = await this.createQueryBuilder('spam')
      .select('AVG(spam.score)', 'avg')
      .getRawOne();
    return result?.avg || 0;
  }

  async getStatsByAction(): Promise<{ action: string; count: number }[]> {
    return this.createQueryBuilder('spam')
      .select('spam.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .groupBy('spam.action')
      .getRawMany();
  }

  async findUserSpamHistory(userId: string, limit: number = 20): Promise<SpamScore[]> {
    return this.createQueryBuilder('spam')
      .where('spam.userId = :userId', { userId })
      .orderBy('spam.createdAt', 'DESC')
      .take(limit)
      .getMany();
  }

  async markAsReviewed(
    id: string,
    reviewedBy: string,
    notes: string,
    isFalsePositive: boolean,
  ): Promise<SpamScore> {
    await this.update(
      { id },
      {
        reviewedAt: new Date(),
        reviewedBy,
        reviewNotes: notes,
        isFalsePositive,
        score: isFalsePositive ? 0 : undefined,
        action: isFalsePositive ? 'none' as any : undefined,
      },
    );
    return this.findOne({ where: { id } });
  }

  async bulkUpdateScores(updates: Array<{ userId: string; score: number; factors: any }>): Promise<void> {
    for (const update of updates) {
      await this.upsert(
        {
          userId: update.userId,
          score: update.score,
          factors: update.factors,
          updatedAt: new Date(),
        },
        ['userId'],
      );
    }
  }
}
