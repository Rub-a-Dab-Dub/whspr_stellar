import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';

export interface StoredEvent {
  event: string;
  data: unknown;
  timestamp: number;
  roomId: string;
}

@Injectable()
export class EventReplayService {
  /** Maximum events stored per room */
  private readonly MAX_EVENTS = 50;
  /** Redis key TTL in seconds (1 hour) */
  private readonly EVENT_TTL_S = 3600;

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  /**
   * Append an event to the room's replay buffer, capping at MAX_EVENTS.
   */
  async storeEvent(roomId: string, event: string, data: unknown): Promise<void> {
    const key = this.roomKey(roomId);
    const payload: StoredEvent = {
      event,
      data,
      timestamp: Date.now(),
      roomId,
    };

    const pipeline = this.redis.pipeline();
    pipeline.rpush(key, JSON.stringify(payload));
    pipeline.ltrim(key, -this.MAX_EVENTS, -1); // keep only the last MAX_EVENTS entries
    pipeline.expire(key, this.EVENT_TTL_S);
    await pipeline.exec();
  }

  /**
   * Return all events stored for `roomId` that occurred after `since` (ms epoch).
   * Used to replay missed events on reconnect.
   */
  async getMissedEvents(roomId: string, since: number): Promise<StoredEvent[]> {
    const raw = await this.redis.lrange(this.roomKey(roomId), 0, -1);
    return raw
      .map((s) => JSON.parse(s) as StoredEvent)
      .filter((e) => e.timestamp > since);
  }

  /**
   * Return up to `limit` most-recent events for a room.
   */
  async getRecentEvents(roomId: string, limit = 50): Promise<StoredEvent[]> {
    const raw = await this.redis.lrange(this.roomKey(roomId), -limit, -1);
    return raw.map((s) => JSON.parse(s) as StoredEvent);
  }

  private roomKey(roomId: string): string {
    return `events:${roomId}`;
  }
}
