import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { LeaderboardEntry, LeaderboardPeriod, LeaderboardType, LeaderboardSnapshot } from './entities/leaderboard-entry.entity';

@Injectable()
export class LeaderboardEntriesRepository extends Repository<LeaderboardEntry> {
  constructor(private dataSource: DataSource) {
    super(LeaderboardEntry, dataSource.createEntityManager());
  }

  async findByUserAndBoard(
    userId: string,
    boardType: LeaderboardType,
    period: LeaderboardPeriod,
  ): Promise<LeaderboardEntry | null> {
    return this.findOne({
      where: { userId, boardType, period },
      relations: ['user'],
    });
  }

  async findLeaderboard(
    boardType: LeaderboardType,
    period: LeaderboardPeriod,
    limit: number = 100,
  ): Promise<LeaderboardEntry[]> {
    return this.createQueryBuilder('lb')
      .leftJoinAndSelect('lb.user', 'user')
      .where('lb.boardType = :boardType', { boardType })
      .andWhere('lb.period = :period', { period })
      .andWhere('lb.rank IS NOT NULL')
      .orderBy('lb.rank', 'ASC')
      .take(limit)
      .getMany();
  }

  async findUserRank(
    userId: string,
    boardType: LeaderboardType,
    period: LeaderboardPeriod,
  ): Promise<LeaderboardEntry | null> {
    return this.findOne({
      where: { userId, boardType, period },
      relations: ['user'],
    });
  }

  async findNearbyUsers(
    rank: number,
    boardType: LeaderboardType,
    period: LeaderboardPeriod,
    range: number = 5,
  ): Promise<LeaderboardEntry[]> {
    return this.createQueryBuilder('lb')
      .leftJoinAndSelect('lb.user', 'user')
      .where('lb.boardType = :boardType', { boardType })
      .andWhere('lb.period = :period', { period })
      .andWhere('lb.rank >= :minRank', { minRank: Math.max(1, rank - range) })
      .andWhere('lb.rank <= :maxRank', { maxRank: rank + range })
      .andWhere('lb.rank IS NOT NULL')
      .orderBy('lb.rank', 'ASC')
      .getMany();
  }

  async countParticipants(boardType: LeaderboardType, period: LeaderboardPeriod): Promise<number> {
    return this.createQueryBuilder('lb')
      .where('lb.boardType = :boardType', { boardType })
      .andWhere('lb.period = :period', { period })
      .andWhere('lb.rank IS NOT NULL')
      .getCount();
  }

  async getStatistics(boardType: LeaderboardType, period: LeaderboardPeriod): Promise<any> {
    return this.createQueryBuilder('lb')
      .select('COUNT(*)', 'count')
      .addSelect('MAX(score)', 'maxScore')
      .addSelect('AVG(score)', 'avgScore')
      .addSelect('PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY score)', 'medianScore')
      .where('lb.boardType = :boardType', { boardType })
      .andWhere('lb.period = :period', { period })
      .andWhere('lb.score > 0')
      .getRawOne();
  }

  async getTopEntry(
    boardType: LeaderboardType,
    period: LeaderboardPeriod,
  ): Promise<LeaderboardEntry | null> {
    return this.createQueryBuilder('lb')
      .leftJoinAndSelect('lb.user', 'user')
      .where('lb.boardType = :boardType', { boardType })
      .andWhere('lb.period = :period', { period })
      .andWhere('lb.rank = 1')
      .getOne();
  }

  async resetPeriodEntries(boardType: LeaderboardType, period: LeaderboardPeriod): Promise<void> {
    await this.update(
      { boardType, period },
      { rank: null, changeFromLastPeriod: 0 },
    );
  }

  async bulkUpdateRanks(
    entries: Array<{ userId: string; rank: number; score: number }>,
    boardType: LeaderboardType,
    period: LeaderboardPeriod,
  ): Promise<void> {
    for (const entry of entries) {
      await this.upsert(
        {
          userId: entry.userId,
          boardType,
          period,
          rank: entry.rank,
          score: entry.score,
          computedAt: new Date(),
        },
        ['userId', 'boardType', 'period'],
      );
    }
  }
}

@Injectable()
export class LeaderboardSnapshotsRepository extends Repository<LeaderboardSnapshot> {
  constructor(private dataSource: DataSource) {
    super(LeaderboardSnapshot, dataSource.createEntityManager());
  }

  async saveSnapshot(
    entries: Array<{
      userId: string;
      boardType: LeaderboardType;
      period: LeaderboardPeriod;
      score: number;
      rank: number;
      rankChange?: number;
    }>,
    snapshotDate: Date,
  ): Promise<void> {
    for (const entry of entries) {
      await this.insert({
        userId: entry.userId,
        boardType: entry.boardType,
        period: entry.period,
        score: entry.score,
        rank: entry.rank,
        rankChangeFromPrevious: entry.rankChange || 0,
        snapshotDate,
      });
    }
  }

  async getUserHistory(
    userId: string,
    boardType: LeaderboardType,
    limit: number = 10,
  ): Promise<LeaderboardSnapshot[]> {
    return this.createQueryBuilder('snap')
      .leftJoinAndSelect('snap.user', 'user')
      .where('snap.userId = :userId', { userId })
      .andWhere('snap.boardType = :boardType', { boardType })
      .orderBy('snap.snapshotDate', 'DESC')
      .take(limit)
      .getMany();
  }

  async getPeriodSnapshot(
    boardType: LeaderboardType,
    period: LeaderboardPeriod,
    limit: number = 100,
  ): Promise<LeaderboardSnapshot[]> {
    return this.createQueryBuilder('snap')
      .leftJoinAndSelect('snap.user', 'user')
      .where('snap.boardType = :boardType', { boardType })
      .andWhere('snap.period = :period', { period })
      .orderBy('snap.rank', 'ASC')
      .take(limit)
      .getMany();
  }
}
