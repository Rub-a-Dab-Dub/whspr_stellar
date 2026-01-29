export enum NotificationType {
  MESSAGE = 'message',
  MENTION = 'mention',
  REPLY = 'reply',
  REACTION = 'reaction',
  ROOM_INVITE = 'room_invite',
  ROOM_JOIN = 'room_join',
  ROOM_LEAVE = 'room_leave',
  REWARD_GRANTED = 'reward_granted',
  LEVEL_UP = 'level_up',
  ACHIEVEMENT = 'achievement',
  SYSTEM = 'system',
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum NotificationChannel {
  IN_APP = 'in_app',
  PUSH = 'push',
  EMAIL = 'email',
  SMS = 'sms',
}