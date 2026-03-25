import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Not, Repository } from 'typeorm';
import { UserSession } from './entities/user-session.entity';

@Injectable()
export class SessionsRepository {
  constructor(
    @InjectRepository(UserSession)
    private readonly repository: Repository<UserSession>,
  ) {}

  create(data: Partial<UserSession>): UserSession {
    return this.repository.create(data);
  }

  save(session: UserSession): Promise<UserSession> {
    return this.repository.save(session);
  }

  findById(id: string): Promise<UserSession | null> {
    return this.repository.findOne({ where: { id } });
  }

  findActiveByUser(userId: string): Promise<UserSession[]> {
    return this.repository.find({
      where: {
        userId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      order: {
        lastActiveAt: 'DESC',
      },
    });
  }

  findActiveById(sessionId: string, userId: string): Promise<UserSession | null> {
    return this.repository.findOne({
      where: {
        id: sessionId,
        userId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
    });
  }

  findRecognizedDevice(
    userId: string,
    deviceInfo: string,
    userAgent: string | null,
  ): Promise<UserSession | null> {
    return this.repository.findOne({
      where: {
        userId,
        deviceInfo,
        userAgent: userAgent ?? IsNull(),
      },
      order: {
        lastActiveAt: 'DESC',
      },
    });
  }

  async revoke(sessionId: string, revokedAt: Date): Promise<boolean> {
    const result = await this.repository.update(
      {
        id: sessionId,
        revokedAt: IsNull(),
      },
      {
        revokedAt,
      },
    );

    return (result.affected ?? 0) > 0;
  }

  async revokeAllExcept(
    userId: string,
    currentSessionId: string,
    revokedAt: Date,
  ): Promise<number> {
    const result = await this.repository.update(
      {
        userId,
        id: Not(currentSessionId),
        revokedAt: IsNull(),
      },
      {
        revokedAt,
      },
    );

    return result.affected ?? 0;
  }

  async updateLastActive(sessionId: string, lastActiveAt: Date): Promise<void> {
    await this.repository.update(
      {
        id: sessionId,
        revokedAt: IsNull(),
      },
      {
        lastActiveAt,
      },
    );
  }

  async deleteExpired(now: Date): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .from(UserSession)
      .where('"expiresAt" <= :now', { now })
      .orWhere('"revokedAt" IS NOT NULL AND "revokedAt" <= :now', { now })
      .execute();

    return result.affected ?? 0;
  }
}
