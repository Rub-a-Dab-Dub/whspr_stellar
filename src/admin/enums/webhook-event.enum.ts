export enum WebhookEvent {
  USER_REGISTERED = 'user.registered',
  USER_BANNED = 'user.banned',
  USER_LEVEL_UP = 'user.level_up',
  ROOM_CREATED = 'room.created',
  ROOM_CLOSED = 'room.closed',
  TRANSACTION_CONFIRMED = 'transaction.confirmed',
  TRANSACTION_FAILED = 'transaction.failed',
  PLATFORM_MAINTENANCE_START = 'platform.maintenance_start',
  PLATFORM_MAINTENANCE_END = 'platform.maintenance_end',
}
