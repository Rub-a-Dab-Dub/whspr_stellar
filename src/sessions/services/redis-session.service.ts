// src/sessions/services/redis-session.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

export interface CachedSession {
  sessionId: string;
  userId: string;
  deviceFingerprint: string;
  ipAddress: string;
  expiresAt: Date;
}

@Injectable()
export class RedisSessionService {
  private readonly SESSION_PREFIX = 'session:';
  private readonly USER_SESSIONS_PREFIX = 'user_sessions:';

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  private getSessionKey(token: string): string {
    return `${this.SESSION_PREFIX}${token}`;
  }

  private getUserSessionsKey(userId: string): string {
    return `${this.USER_SESSIONS_PREFIX}${userId}`;
  }

  async setSession(
    token: string,
    sessionData: CachedSession,
    ttl: number,
  ): Promise<void> {
    const key = this.getSessionKey(token);
    await this.cacheManager.set(key, sessionData, ttl);

    // Add to user's session set
    await this.addToUserSessions(sessionData.userId, token);
  }

  async getSession(token: string): Promise<CachedSession | undefined> {
    const key = this.getSessionKey(token);
    return await this.cacheManager.get<CachedSession>(key);
  }

  async deleteSession(token: string, userId?: string): Promise<void> {
    const key = this.getSessionKey(token);
    await this.cacheManager.del(key);

    if (userId) {
      await this.removeFromUserSessions(userId, token);
    }
  }

  async refreshSession(token: string, ttl: number): Promise<void> {
    const session = await this.getSession(token);
    if (session) {
      await this.setSession(token, session, ttl);
    }
  }

  private async addToUserSessions(
    userId: string,
    token: string,
  ): Promise<void> {
    const key = this.getUserSessionsKey(userId);
    const sessions = (await this.cacheManager.get<string[]>(key)) || [];

    if (!sessions.includes(token)) {
      sessions.push(token);
      await this.cacheManager.set(key, sessions, 86400 * 30); // 30 days
    }
  }

  private async removeFromUserSessions(
    userId: string,
    token: string,
  ): Promise<void> {
    const key = this.getUserSessionsKey(userId);
    const sessions = (await this.cacheManager.get<string[]>(key)) || [];

    const filtered = sessions.filter((t) => t !== token);

    if (filtered.length > 0) {
      await this.cacheManager.set(key, filtered, 86400 * 30);
    } else {
      await this.cacheManager.del(key);
    }
  }

  async getUserSessions(userId: string): Promise<string[]> {
    const key = this.getUserSessionsKey(userId);
    return (await this.cacheManager.get<string[]>(key)) || [];
  }

  async deleteAllUserSessions(userId: string): Promise<void> {
    const tokens = await this.getUserSessions(userId);

    await Promise.all(tokens.map((token) => this.deleteSession(token)));

    const key = this.getUserSessionsKey(userId);
    await this.cacheManager.del(key);
  }
}
