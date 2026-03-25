import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class PresenceService implements OnModuleDestroy {
  /** Redis TTL for presence keys in seconds (must be > heartbeat interval) */
  private readonly PRESENCE_TTL_S = 30;
  private readonly ONLINE_SET = 'presence:online';

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async setOnline(userId: string, socketId: string): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.set(`presence:socket:${userId}`, socketId, 'EX', this.PRESENCE_TTL_S);
    pipeline.set(`presence:ts:${userId}`, Date.now().toString(), 'EX', this.PRESENCE_TTL_S);
    pipeline.sadd(this.ONLINE_SET, userId);
    await pipeline.exec();
  }

  async setOffline(userId: string): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.del(`presence:socket:${userId}`);
    pipeline.del(`presence:ts:${userId}`);
    pipeline.srem(this.ONLINE_SET, userId);
    await pipeline.exec();
  }

  async isOnline(userId: string): Promise<boolean> {
    const exists = await this.redis.exists(`presence:socket:${userId}`);
    return exists === 1;
  }

  async getOnlineUsers(): Promise<string[]> {
    return this.redis.smembers(this.ONLINE_SET);
  }

  async getSocketId(userId: string): Promise<string | null> {
    return this.redis.get(`presence:socket:${userId}`);
  }

  /** Refresh TTL so long-lived connections don't expire during an active session */
  async refreshPresence(userId: string): Promise<void> {
    const socketId = await this.getSocketId(userId);
    if (socketId) {
      await this.setOnline(userId, socketId);
    }
  }

  async onModuleDestroy(): Promise<void> {
    // Let the module that owns the Redis client handle closure
  }
}
