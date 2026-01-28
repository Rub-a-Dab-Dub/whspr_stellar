export enum NotificationType {
  // Message notifications
  MESSAGE = 'message',
  MENTION = 'mention',
  REPLY = 'reply',
  REACTION = 'reaction',
  
  // Room notifications
  ROOM_INVITATION = 'room_invitation',
  ROOM_JOIN = 'room_join',
  ROOM_LEAVE = 'room_leave',
  ROOM_ROLE_CHANGE = 'room_role_change',
  ROOM_BAN = 'room_ban',
  ROOM_UNBAN = 'room_unban',
  
  // System notifications
  LEVEL_UP = 'level_up',
  ACHIEVEMENT_UNLOCKED = 'achievement_unlocked',
  REWARD_GRANTED = 'reward_granted',
  REWARD_EXPIRED = 'reward_expired',
  REWARD_TRADED = 'reward_traded',
  REWARD_GIFTED = 'reward_gifted',
  
  // Security notifications
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  PASSWORD_CHANGED = 'password_changed',
  EMAIL_CHANGED = 'email_changed',
  
  // Admin notifications
  USER_REPORTED = 'user_reported',
  CONTENT_FLAGGED = 'content_flagged',
  MODERATION_ACTION = 'moderation_action',
  
  // General notifications
  ANNOUNCEMENT = 'announcement',
  MAINTENANCE = 'maintenance',
  WELCOME = 'welcome',
}