import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { AuditLogService } from './audit-log.service';
import { ConfigService } from '@nestjs/config';

export type RateLimitBucket = {
  key: string;
  currentCount: number;
  limit?: number;
  windowSeconds?: number;
  resetsAt?: string | null;
  isBlocked: boolean;
};

@Injectable()
export class RateLimitsService {
  private readonly logger = new Logger(RateLimitsService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly auditLogService: AuditLogService,
    private readonly config: ConfigService,
  ) {}

  private actionConfigMap(): Record<string, { limit: number; windowSeconds: number }> {
    return {
      message_send: {
        limit: Number(this.config.get('RATE_LIMIT_MESSAGE_SEND_LIMIT') ?? 20),
        windowSeconds: Number(this.config.get('RATE_LIMIT_MESSAGE_SEND_WINDOW_SECONDS') ?? 60),
      },
      tip_action: {
        limit: Number(this.config.get('RATE_LIMIT_TIP_ACTION_LIMIT') ?? 10),
        windowSeconds: Number(this.config.get('RATE_LIMIT_TIP_ACTION_WINDOW_SECONDS') ?? 60),
      },
      room_create: {
        limit: Number(this.config.get('RATE_LIMIT_ROOM_CREATE_LIMIT') ?? 2),
        windowSeconds: Number(this.config.get('RATE_LIMIT_ROOM_CREATE_WINDOW_SECONDS') ?? 3600),
      },
    };
  }

  async getUserBuckets(userId: string): Promise<RateLimitBucket[]> {
    // naive key discovery: find any redis keys containing the userId
    const pattern = `*${userId}*`;
    const keys = await this.redis.keys(pattern);

    const buckets: RateLimitBucket[] = [];

    const cfg = this.actionConfigMap();

    for (const k of keys) {
      try {
        const current = await this.redis.getInt(k);
        const ttl = await this.redis.ttl(k);

        // attempt to map action from key name (pick first known action substring)
        const actionKey = Object.keys(cfg).find((a) => k.includes(a));
        const actionCfg = actionKey ? cfg[actionKey] : undefined;

        const bucket = {
          key: k,
          currentCount: current,
          limit: actionCfg?.limit,
          windowSeconds: actionCfg?.windowSeconds,
          resetsAt: ttl > 0 ? new Date(Date.now() + ttl * 1000).toISOString() : null,
          isBlocked: actionCfg ? current >= actionCfg.limit : current > 0,
        } as RateLimitBucket;

        buckets.push(bucket);
      } catch (err) {
        this.logger.warn(`Failed to inspect throttler key ${k}: ${err.message}`);
      }
    }

    return buckets;
  }

  async resetUserBucket(userId: string, key: string, actorId?: string, reason?: string) {
    // delete the specific key
    await this.redis.del(key);
    await this.auditLogService.createAuditLog({
      actorUserId: actorId || null,
      targetUserId: userId,
      action: 'ADMIN_RESET_RATE_LIMIT' as any,
      eventType: 'ADMIN' as any,
      details: `Reset rate limit key ${key}`,
      metadata: { key, reason },
    });
  }

  async resetAllUserBuckets(userId: string, actorId?: string, reason?: string) {
    const pattern = `*${userId}*`;
    const keys = await this.redis.keys(pattern);
    for (const k of keys) {
      await this.redis.del(k);
      await this.auditLogService.createAuditLog({
        actorUserId: actorId || null,
        targetUserId: userId,
        action: 'ADMIN_RESET_RATE_LIMIT' as any,
        eventType: 'ADMIN' as any,
        details: `Reset rate limit key ${k}`,
        metadata: { key: k, reason },
      });
    }
    return { deleted: keys.length };
  }

  async getTopBlocked(limit = 20): Promise<Array<{ userId: string; blockedCount: number }>> {
    // scan all keys and aggregate by detected userId token
    const allKeys = await this.redis.keys('*');
    const map = new Map<string, number>();
    for (const k of allKeys) {
      // try to extract a UUID-like token from the key
      const match = k.match(/[0-9a-fA-F\-]{8,}/);
      if (!match) continue;
      const uid = match[0];
      const count = await this.redis.getInt(k);
      if (count > 0) {
        map.set(uid, (map.get(uid) || 0) + 1);
      }
    }

    const arr = Array.from(map.entries()).map(([userId, blockedCount]) => ({ userId, blockedCount }));
    arr.sort((a, b) => b.blockedCount - a.blockedCount);
    return arr.slice(0, limit);
  }

  getConfig() {
    const cfg = this.actionConfigMap();
    return Object.keys(cfg).map((k) => ({ key: k, limit: cfg[k].limit, windowSeconds: cfg[k].windowSeconds }));
  }
}
