import { InAppNotificationType } from '../entities/notification.entity';

export interface CreateNotificationDto {
  userId: string;
  type: InAppNotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}
