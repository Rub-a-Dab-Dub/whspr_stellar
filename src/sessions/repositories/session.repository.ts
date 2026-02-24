// src/sessions/repositories/session.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Session } from '../entities/session.entity';

@Injectable()
export class SessionRepository {
  constructor(
    @InjectRepository(Session)
    private readonly repository: Repository<Session>,
  ) {}

  async create(sessionData: Partial<Session>): Promise<Session> {
    const session = this.repository.create(sessionData);
    return this.repository.save(session);
  }

  async findByToken(token: string): Promise<Session | null> {
    return this.repository.findOne({
      where: { token, isActive: true },
      relations: ['user'],
    });
  }

  async findById(id: string): Promise<Session | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['user'],
    });
  }

  async findActiveByRefreshToken(
    refreshToken: string,
  ): Promise<Session | null> {
    return this.repository.findOne({
      where: { refreshToken, isActive: true },
    });
  }

  async findActiveByUserId(userId: string): Promise<Session[]> {
    return this.repository.find({
      where: { userId, isActive: true },
      order: { lastActivity: 'DESC' },
    });
  }

  async findAllByUserId(userId: string): Promise<Session[]> {
    return this.repository.find({
      where: { userId },
      order: { lastActivity: 'DESC' },
    });
  }

  async countActiveSessions(userId: string): Promise<number> {
    return this.repository.count({
      where: { userId, isActive: true },
    });
  }

  async updateLastActivity(id: string): Promise<void> {
    await this.repository.update(id, {
      lastActivity: new Date(),
    });
  }

  async updateSession(id: string, updates: Partial<Session>): Promise<void> {
    await this.repository.update(id, updates);
  }

  async revokeSession(id: string): Promise<void> {
    await this.repository.update(id, {
      isActive: false,
    });
  }

  async revokeAllUserSessions(
    userId: string,
    exceptSessionId?: string,
  ): Promise<void> {
    const query = this.repository
      .createQueryBuilder()
      .update(Session)
      .set({ isActive: false })
      .where('user_id = :userId', { userId })
      .andWhere('is_active = :isActive', { isActive: true });

    if (exceptSessionId) {
      query.andWhere('id != :exceptSessionId', { exceptSessionId });
    }

    await query.execute();
  }

  async deleteExpiredSessions(): Promise<number> {
    const result = await this.repository.delete({
      expiresAt: LessThan(new Date()),
    });
    return result.affected || 0;
  }

  async deleteInactiveSessions(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.repository.delete({
      isActive: false,
      updatedAt: LessThan(cutoffDate),
    });
    return result.affected || 0;
  }
}
