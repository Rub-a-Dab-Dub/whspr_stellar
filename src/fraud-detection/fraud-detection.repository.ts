import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoginAttempt } from './entities/login-attempt.entity';
import { LoginAction } from './enums/login-action.enum';

@Injectable()
export class FraudDetectionRepository {
  constructor(
    @InjectRepository(LoginAttempt)
    private readonly repo: Repository<LoginAttempt>,
  ) {}

  async save(data: Partial<LoginAttempt>): Promise<LoginAttempt> {
    return this.repo.save(data);
  }

  async findByUser(
    userId: string,
    limit = 20,
    offset = 0,
  ): Promise<[LoginAttempt[], number]> {
    return this.repo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async findAll(limit = 20, offset = 0): Promise<[LoginAttempt[], number]> {
    return this.repo.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  // Get the last N distinct IPs used by a user in the last X minutes
  async getRecentIPs(
    userId: string,
    withinMinutes: number,
    limit: number,
  ): Promise<string[]> {
    const rows = await this.repo
      .createQueryBuilder('la')
      .select('DISTINCT la."ipAddress"', 'ip')
      .where('la."userId" = :userId', { userId })
      .andWhere(
        `la."createdAt" > NOW() - INTERVAL '${withinMinutes} minutes'`,
      )
      .limit(limit)
      .getRawMany();

    return rows.map((r) => r.ip);
  }

  // Get the last known country for a user (before current login)
  async getLastKnownCountry(userId: string): Promise<string | null> {
    const row = await this.repo.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
      select: ['country'],
    });
    return row?.country ?? null;
  }

  async countRecentFailedAttempts(
    userId: string,
    withinMinutes: number,
  ): Promise<number> {
    return this.repo
      .createQueryBuilder('la')
      .where('la."userId" = :userId', { userId })
      .andWhere('la.action = :action', { action: LoginAction.BLOCKED })
      .andWhere(
        `la."createdAt" > NOW() - INTERVAL '${withinMinutes} minutes'`,
      )
      .getCount();
  }
}