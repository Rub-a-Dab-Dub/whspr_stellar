import { MemberRole } from '../entities/room-member.entity';

export const ROOM_MEMBER_CONSTANTS = {
  DEFAULT_MAX_MEMBERS: 500,
  MIN_MAX_MEMBERS: 2,
  MAX_MAX_MEMBERS: 10000,
  INVITATION_EXPIRY_DAYS: 30,
  INVITATION_EXPIRY_HOURS: 30 * 24,
  ACTIVITY_UPDATE_INTERVAL_MS: 60000, // 1 minute
  MEMBER_CACHE_TTL: 300, // 5 minutes in seconds
};

export enum MemberPermission {
  SEND_MESSAGE = 'SEND_MESSAGE',
  EDIT_MESSAGE = 'EDIT_MESSAGE',
  DELETE_MESSAGE = 'DELETE_MESSAGE',
  INVITE_MEMBERS = 'INVITE_MEMBERS',
  KICK_MEMBERS = 'KICK_MEMBERS',
  MANAGE_ROLES = 'MANAGE_ROLES',
  CHANGE_ROOM_SETTINGS = 'CHANGE_ROOM_SETTINGS',
  VIEW_ANALYTICS = 'VIEW_ANALYTICS',
  PIN_MESSAGE = 'PIN_MESSAGE',
  MANAGE_INVITATIONS = 'MANAGE_INVITATIONS',
}

export const ROLE_PERMISSIONS: Record<MemberRole, MemberPermission[]> = {
  [MemberRole.OWNER]: [
    MemberPermission.SEND_MESSAGE,
    MemberPermission.EDIT_MESSAGE,
    MemberPermission.DELETE_MESSAGE,
    MemberPermission.INVITE_MEMBERS,
    MemberPermission.KICK_MEMBERS,
    MemberPermission.MANAGE_ROLES,
    MemberPermission.CHANGE_ROOM_SETTINGS,
    MemberPermission.VIEW_ANALYTICS,
    MemberPermission.PIN_MESSAGE,
    MemberPermission.MANAGE_INVITATIONS,
  ],
  [MemberRole.ADMIN]: [
    MemberPermission.SEND_MESSAGE,
    MemberPermission.EDIT_MESSAGE,
    MemberPermission.DELETE_MESSAGE,
    MemberPermission.INVITE_MEMBERS,
    MemberPermission.KICK_MEMBERS,
    MemberPermission.MANAGE_ROLES,
    MemberPermission.CHANGE_ROOM_SETTINGS,
    MemberPermission.VIEW_ANALYTICS,
    MemberPermission.PIN_MESSAGE,
    MemberPermission.MANAGE_INVITATIONS,
  ],
  [MemberRole.MODERATOR]: [
    MemberPermission.SEND_MESSAGE,
    MemberPermission.EDIT_MESSAGE,
    MemberPermission.DELETE_MESSAGE,
    MemberPermission.INVITE_MEMBERS,
    MemberPermission.KICK_MEMBERS,
    MemberPermission.VIEW_ANALYTICS,
    MemberPermission.PIN_MESSAGE,
    MemberPermission.MANAGE_INVITATIONS,
  ],
  [MemberRole.MEMBER]: [
    MemberPermission.SEND_MESSAGE,
    MemberPermission.EDIT_MESSAGE,
    MemberPermission.DELETE_MESSAGE,
    MemberPermission.INVITE_MEMBERS,
  ],
};

export enum ActivityType {
  JOINED = 'JOINED',
  LEFT = 'LEFT',
  MESSAGE_SENT = 'MESSAGE_SENT',
  MESSAGE_EDITED = 'MESSAGE_EDITED',
  MESSAGE_DELETED = 'MESSAGE_DELETED',
  ROLE_CHANGED = 'ROLE_CHANGED',
  PERMISSION_CHANGED = 'PERMISSION_CHANGED',
  MEMBER_KICKED = 'MEMBER_KICKED',
  MEMBER_INVITED = 'MEMBER_INVITED',
}

export const MEMBER_ACTIVITY_TYPES = Object.values(ActivityType);

export const INVITATION_CONFIG = {
  TOKEN_LENGTH: 32,
  EXPIRY_DAYS: 30,
  MAX_INVITATIONS_PER_DAY: 100,
  RESEND_COOLDOWN_MINUTES: 5,
};

export const ERROR_MESSAGES = {
  USER_NOT_IN_ROOM: 'User is not a member of this room',
  ALREADY_IN_ROOM: 'User is already a member of this room',
  INVALID_INVITE_TOKEN: 'Invalid or expired invitation token',
  MAX_MEMBERS_REACHED: 'Room has reached maximum member limit',
  CANNOT_KICK_SELF: 'Cannot kick yourself from the room',
  CANNOT_KICK_ADMIN: 'Cannot kick an admin',
  INSUFFICIENT_PERMISSIONS: 'You do not have permission to perform this action',
  INVITATION_EXPIRED: 'This invitation has expired',
  INVITATION_ALREADY_USED: 'This invitation has already been used',
  PERMISSION_DENIED: 'Permission denied',
  ROOM_NOT_FOUND: 'Room not found',
  USER_NOT_FOUND: 'User not found',
};
