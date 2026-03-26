import { Platform } from '../entities/push-subscription.entity';

export interface NotificationPayload {
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: string;
  clickAction?: string;
}

export interface PushJobData {
  userId?: string;
  userIds?: string[];
  topic?: string;
  payload: NotificationPayload;
  notificationType?: string;
}

export interface SendResult {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
}

export interface DeviceRegistrationResult {
  subscriptionId: string;
  userId: string;
  platform: Platform;
  isNew: boolean;
}
