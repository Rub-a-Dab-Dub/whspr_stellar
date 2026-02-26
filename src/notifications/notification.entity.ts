export type NotificationType =
  | "TIP_RECEIVED"
  | "ROOM_INVITE"
  | "LEVEL_UP"
  | "QUEST_COMPLETE"
  | "MENTION"
  | "BADGE_EARNED"
  | "MESSAGE";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, any>;
  isRead: boolean;
  createdAt: Date;
}
