import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WaitlistEntry } from './entities/waitlist-entry.entity';

@Injectable()
export class WaitlistRepository {
  constructor(
    @InjectRepository(WaitlistEntry)
    private readonly repo: Repository<WaitlistEntry>,
  ) {}

  async findByEmail(email: string): Promise<WaitlistEntry | null> {
    return this.repo.findOne({ where: { email } });
  }

  async findByReferralCode(code: string): Promise<WaitlistEntry | null> {
    return this.repo.findOne({ where: { referralCode: code } });
  }

  async findById(id: string): Promise<WaitlistEntry | null> {
    return this.repo.findOne({ where: { id } });
  }

  async save(data: Partial<WaitlistEntry>): Promise<WaitlistEntry> {
    return this.repo.save(data);
  }

  async addPoints(id: string, pts: number): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(WaitlistEntry)
      .set({ points: () => `points + ${pts}` })
      .where('id = :id', { id })
      .execute();
  }

  async recalculatePositions(): Promise<void> {
    // Rank all non-converted entries by points DESC, joinedAt ASC (earlier = better tiebreak)
    await this.repo.query(`
      UPDATE waitlist_entries we
      SET position = ranked.row_num
      FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 ORDER BY points DESC, "joinedAt" ASC
               ) AS row_num
        FROM waitlist_entries
        WHERE "isConverted" = false
      ) ranked
      WHERE we.id = ranked.id
    `);
  }

  async getLeaderboard(limit = 100): Promise<WaitlistEntry[]> {
    return this.repo.find({
      where: { isConverted: false },
      order: { points: 'DESC', joinedAt: 'ASC' },
      take: limit,
      select: ['id', 'email', 'points', 'position', 'joinedAt'],
    });
  }

  async countByIpInLastHour(ip: string): Promise<number> {
    return this.repo
      .createQueryBuilder('w')
      .where('w.ipAddress = :ip', { ip })
      .andWhere(`w."joinedAt" > NOW() - INTERVAL '1 hour'`)
      .getCount();
  }

  async markConverted(id: string): Promise<void> {
    await this.repo.update(id, { isConverted: true });
  }
}