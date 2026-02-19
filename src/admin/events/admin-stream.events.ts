/**
 * Admin event stream payload types.
 * Each event includes type, timestamp, and relevant entity summary.
 */
export type AdminStreamEventType =
  | 'user.banned'
  | 'user.registered'
  | 'transaction.large'
  | 'room.flagged'
  | 'platform.error';

export interface AdminStreamEventPayload {
  type: AdminStreamEventType;
  timestamp: string;
  entity: Record<string, unknown>;
}

export interface UserBannedEntity {
  userId: string;
  email?: string;
  bannedBy: string;
  reason?: string;
}

export interface UserRegisteredEntity {
  userId: string;
  email: string;
}

export interface TransactionLargeEntity {
  transferId: string;
  amount: string;
  senderId: string;
  recipientId: string;
  threshold: number;
}

export interface RoomFlaggedEntity {
  roomId: string;
  messageId?: string;
  reason: string;
  reportedBy?: string;
  contentPreview?: string;
}

export interface PlatformErrorEntity {
  message: string;
  code?: string;
  context?: string;
}
