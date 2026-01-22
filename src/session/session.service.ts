import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly SESSION_PREFIX = 'session:';
  private readonly DEFAULT_TTL = 86400; // 24 hours in seconds

  constructor(private readonly redisService: RedisService) {}

  /**
   * Get session data by session ID
   */
  async getSession(sessionId: string): Promise<any> {
    try {
      const key = this.getSessionKey(sessionId);
      const client = this.redisService.getClient();
      const data = await client.get(key);
      
      if (data) {
        this.logger.debug(`Session retrieved: ${sessionId}`);
        return JSON.parse(data);
      }
      
      this.logger.debug(`Session not found: ${sessionId}`);
      return null;
    } catch (error) {
      this.logger.error(`Error getting session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Set session data with optional TTL
   */
  async setSession(sessionId: string, data: any, ttl?: number): Promise<void> {
    try {
      const key = this.getSessionKey(sessionId);
      const client = this.redisService.getClient();
      const sessionTTL = ttl || this.DEFAULT_TTL;
      
      await client.setex(key, sessionTTL, JSON.stringify(data));
      this.logger.debug(`Session set: ${sessionId} with TTL: ${sessionTTL}s`);
    } catch (error) {
      this.logger.error(`Error setting session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Update existing session data
   */
  async updateSession(sessionId: string, data: Partial<any>): Promise<void> {
    try {
      const existingData = await this.getSession(sessionId);
      if (!existingData) {
        throw new Error(`Session ${sessionId} not found`);
      }

      const updatedData = { ...existingData, ...data };
      await this.setSession(sessionId, updatedData);
      this.logger.debug(`Session updated: ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error updating session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Destroy a session
   */
  async destroySession(sessionId: string): Promise<void> {
    try {
      const key = this.getSessionKey(sessionId);
      const client = this.redisService.getClient();
      await client.del(key);
      this.logger.debug(`Session destroyed: ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error destroying session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Refresh session TTL (extend expiration)
   */
  async refreshSession(sessionId: string, ttl?: number): Promise<void> {
    try {
      const key = this.getSessionKey(sessionId);
      const client = this.redisService.getClient();
      const sessionTTL = ttl || this.DEFAULT_TTL;
      
      const exists = await client.exists(key);
      if (!exists) {
        throw new Error(`Session ${sessionId} not found`);
      }

      await client.expire(key, sessionTTL);
      this.logger.debug(`Session refreshed: ${sessionId} with TTL: ${sessionTTL}s`);
    } catch (error) {
      this.logger.error(`Error refreshing session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Get all active session IDs for a user
   */
  async getUserSessions(userId: string): Promise<string[]> {
    try {
      const pattern = `${this.SESSION_PREFIX}*`;
      const client = this.redisService.getClient();
      const keys = await client.keys(pattern);
      
      const userSessions: string[] = [];
      for (const key of keys) {
        const data = await client.get(key);
        if (data) {
          const sessionData = JSON.parse(data);
          if (sessionData.userId === userId) {
            userSessions.push(key.replace(this.SESSION_PREFIX, ''));
          }
        }
      }
      
      return userSessions;
    } catch (error) {
      this.logger.error(`Error getting user sessions for ${userId}:`, error);
      return [];
    }
  }

  /**
   * Destroy all sessions for a user
   */
  async destroyUserSessions(userId: string): Promise<void> {
    try {
      const sessions = await this.getUserSessions(userId);
      for (const sessionId of sessions) {
        await this.destroySession(sessionId);
      }
      this.logger.log(`Destroyed ${sessions.length} sessions for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error destroying user sessions for ${userId}:`, error);
      throw error;
    }
  }

  private getSessionKey(sessionId: string): string {
    return `${this.SESSION_PREFIX}${sessionId}`;
  }
}
