import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Server, Socket } from 'socket.io';
import { OfflineMessageQueue, QueueStatus } from './entities/offline-message-queue.entity';
import { EnqueueMessageDto, QueueStatsDto, FlushResultDto } from './dto/offline-queue.dto';

/** Redis sorted-set key for a user's offline queue. Score = epoch ms. */
const redisKey = (userId: string) => `offline:queue:${userId}`;

/** Messages older than this in Redis are also flushed to Postgres for durability. */
const ONE_HOUR_MS = 60 * 60 * 1000;

/** Alert threshold: if any user's queue exceeds this, log a warning (and expose via stats). */
const ALERT_THRESHOLD = 1000;

export interface QueuedMessage {
  messageId: string;
  conversationId: string;
  payload: Record<string, unknown>;
  queuedAt: number; // epoch ms
}

@Injectable()
export class OfflineQueueService {
  private readonly logger = new Logger(OfflineQueueService.name);

  constructor(
    @InjectRepository(OfflineMessageQueue)
    private readonly queueRepo: Repository<OfflineMessageQueue>,
    @Inject('OFFLINE_REDIS_CLIENT')
    private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  // ── Core queue operations ──────────────────────────────────────────────────

  /**
   * Enqueue a message for an offline recipient.
   * Stores in Redis sorted set (score = timestamp). If the message has been
   * in Redis for over 1 hour it will be persisted to Postgres by the cron job.
   */
  async enqueue(dto: EnqueueMessageDto): Promise<void> {
    const now = Date.now();
    const entry: QueuedMessage = {
      messageId: dto.messageId,
      conversationId: dto.conversationId,
      payload: dto.payload,
      queuedAt: now,
    };

    const key = redisKey(dto.recipientId);
    await this.redis.zadd(key, now, JSON.stringify(entry));

    const depth = await this.redis.zcard(key);
    if (depth > ALERT_THRESHOLD) {
      this.logger.warn(
        `[OfflineQueue] ALERT: user=${dto.recipientId} queue depth=${depth} exceeds ${ALERT_THRESHOLD}`,
      );
    }

    this.logger.debug(
      `[OfflineQueue] enqueued messageId=${dto.messageId} for userId=${dto.recipientId}`,
    );
  }

  /**
   * Return all queued messages for a user in chronological order (lowest score first).
   * Does NOT remove them — call markDelivered() after successful delivery.
   */
  async dequeueForUser(userId: string): Promise<QueuedMessage[]> {
    const raw = await this.redis.zrangebyscore(redisKey(userId), '-inf', '+inf');
    return raw.map((s) => JSON.parse(s) as QueuedMessage);
  }

  /**
   * Mark a specific message as delivered: remove from Redis and upsert in Postgres.
   */
  async markDelivered(userId: string, messageId: string): Promise<void> {
    // Remove from Redis sorted set by value scan
    const raw = await this.redis.zrangebyscore(redisKey(userId), '-inf', '+inf');
    for (const s of raw) {
      const entry = JSON.parse(s) as QueuedMessage;
      if (entry.messageId === messageId) {
        await this.redis.zrem(redisKey(userId), s);
        break;
      }
    }

    // Update Postgres record if it exists
    await this.queueRepo.update(
      { recipientId: userId, messageId, status: QueueStatus.QUEUED },
      { status: QueueStatus.DELIVERED, deliveredAt: new Date() },
    );
  }

  /**
   * Retry FAILED records: reset status to QUEUED so the next flush attempt picks them up.
   */
  async retryFailed(userId: string): Promise<number> {
    const result = await this.queueRepo.update(
      { recipientId: userId, status: QueueStatus.FAILED },
      { status: QueueStatus.QUEUED, attempts: 0 },
    );
    const count = result.affected ?? 0;
    this.logger.log(`[OfflineQueue] retried ${count} failed records for userId=${userId}`);
    return count;
  }

  /**
   * Return the current Redis queue depth for a user.
   */
  async getQueueDepth(userId: string): Promise<number> {
    return this.redis.zcard(redisKey(userId));
  }

  /**
   * Flush all queued messages to an online socket in chronological order.
   * Emits sync:start → messages → sync:complete.
   */
  async flushOnConnect(userId: string, client: Socket | Server, targetSocketId?: string): Promise<FlushResultDto> {
    const messages = await this.dequeueForUser(userId);
    const total = messages.length;

    if (total === 0) {
      return { userId, flushed: 0, failed: 0 };
    }

    // Determine the emit target
    const emitTarget = targetSocketId
      ? (client as Server).to(targetSocketId)
      : (client as Socket);

    // ── sync:start ──────────────────────────────────────────────────────────
    emitTarget.emit('sync:start', {
      userId,
      pendingCount: total,
      timestamp: Date.now(),
    });

    let flushed = 0;
    let failed = 0;

    for (const msg of messages) {
      try {
        emitTarget.emit('message:queued', {
          ...msg.payload,
          messageId: msg.messageId,
          conversationId: msg.conversationId,
          queuedAt: msg.queuedAt,
          replayed: true,
        });

        await this.markDelivered(userId, msg.messageId);
        flushed++;
      } catch (err) {
        failed++;
        this.logger.error(
          `[OfflineQueue] failed to deliver messageId=${msg.messageId} to userId=${userId}: ${(err as Error).message}`,
        );

        // Increment attempt counter in Postgres if persisted
        await this.queueRepo
          .createQueryBuilder()
          .update(OfflineMessageQueue)
          .set({
            attempts: () => 'attempts + 1',
            status: QueueStatus.FAILED,
          })
          .where('recipientId = :userId AND messageId = :messageId', {
            userId,
            messageId: msg.messageId,
          })
          .execute()
          .catch(() => undefined); // silently ignore if not persisted yet
      }
    }

    // ── sync:complete ────────────────────────────────────────────────────────
    emitTarget.emit('sync:complete', {
      userId,
      flushed,
      failed,
      timestamp: Date.now(),
    });

    this.logger.log(
      `[OfflineQueue] flush complete userId=${userId} flushed=${flushed} failed=${failed}`,
    );

    return { userId, flushed, failed };
  }

  /**
   * Prune DELIVERED records older than 30 days from Postgres.
   */
  async pruneOld(): Promise<number> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await this.queueRepo.delete({
      status: QueueStatus.DELIVERED,
      deliveredAt: LessThan(cutoff),
    });
    const removed = result.affected ?? 0;
    if (removed > 0) {
      this.logger.log(`[OfflineQueue] pruned ${removed} delivered records older than 30 days`);
    }
    return removed;
  }

  // ── Durability: Redis → Postgres for long-lived messages ──────────────────

  /**
   * Persist any Redis-queued messages older than 1 hour to Postgres for durability.
   * Called by cron every 10 minutes.
   */
  async persistStaleRedisEntries(): Promise<void> {
    // Scan all offline:queue:* keys
    const pattern = 'offline:queue:*';
    let cursor = '0';
    let persisted = 0;

    do {
      const [next, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;

      for (const key of keys) {
        const userId = key.replace('offline:queue:', '');
        const cutoff = Date.now() - ONE_HOUR_MS;
        // Get entries with score < cutoff (older than 1 hour)
        const raw = await this.redis.zrangebyscore(key, '-inf', cutoff);

        for (const s of raw) {
          const entry = JSON.parse(s) as QueuedMessage;
          const existing = await this.queueRepo.findOne({
            where: { recipientId: userId, messageId: entry.messageId },
          });

          if (!existing) {
            await this.queueRepo.save(
              this.queueRepo.create({
                recipientId: userId,
                messageId: entry.messageId,
                conversationId: entry.conversationId,
                payload: entry.payload,
                queuedAt: new Date(entry.queuedAt),
                status: QueueStatus.QUEUED,
                attempts: 0,
              }),
            );
            persisted++;
          }
        }
      }
    } while (cursor !== '0');

    if (persisted > 0) {
      this.logger.log(`[OfflineQueue] persisted ${persisted} stale Redis entries to Postgres`);
    }
  }

  // ── Admin helpers ──────────────────────────────────────────────────────────

  async getStats(): Promise<QueueStatsDto> {
    const [totalQueued, totalDelivered, totalFailed] = await Promise.all([
      this.queueRepo.count({ where: { status: QueueStatus.QUEUED } }),
      this.queueRepo.count({ where: { status: QueueStatus.DELIVERED } }),
      this.queueRepo.count({ where: { status: QueueStatus.FAILED } }),
    ]);

    // Check live Redis queue depths for alert
    const alertedUsers: Array<{ userId: string; depth: number }> = [];
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(cursor, 'MATCH', 'offline:queue:*', 'COUNT', 100);
      cursor = next;
      for (const key of keys) {
        const depth = await this.redis.zcard(key);
        if (depth > ALERT_THRESHOLD) {
          alertedUsers.push({ userId: key.replace('offline:queue:', ''), depth });
        }
      }
    } while (cursor !== '0');

    return { totalQueued, totalDelivered, totalFailed, alertedUsers };
  }

  // ── Scheduled jobs ─────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_10_MINUTES)
  async scheduledPersistStale(): Promise<void> {
    await this.persistStaleRedisEntries();
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduledPrune(): Promise<void> {
    await this.pruneOld();
  }
}
