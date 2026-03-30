export class EnqueueMessageDto {
  recipientId: string;
  messageId: string;
  conversationId: string;
  payload: Record<string, unknown>;
}

export class QueueStatsDto {
  /** Total QUEUED entries across all users (DB count). */
  totalQueued: number;
  /** Total DELIVERED entries (DB count). */
  totalDelivered: number;
  /** Total FAILED entries (DB count). */
  totalFailed: number;
  /** Users whose Redis queue depth exceeds the alert threshold. */
  alertedUsers: Array<{ userId: string; depth: number }>;
}

export class UserQueueDepthDto {
  userId: string;
  redisDepth: number;
  dbQueued: number;
}

export class FlushResultDto {
  userId: string;
  flushed: number;
  failed: number;
}
