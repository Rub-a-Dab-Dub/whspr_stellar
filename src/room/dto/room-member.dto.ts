import { IsUUID, IsOptional, IsString, IsEnum, IsArray, MinLength } from 'class-validator';
import { MemberRole } from '../entities/room-member.entity';

export class JoinRoomDto {
  @IsOptional()
  @IsString()
  inviteToken?: string;
}

export class LeaveRoomDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  reason?: string;
}

export class KickMemberDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  reason?: string;
}

export class UpdateMemberRoleDto {
  @IsEnum(MemberRole)
  role: MemberRole;
}

export class AssignPermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}

export class RoomMemberResponseDto {
  id: string;
  roomId: string;
  userId: string;
  user?: {
    id: string;
    username: string;
    email: string;
    avatar?: string;
  };
  role: MemberRole;
  status: string;
  permissions: string[];
  joinedAt: Date;
  lastActivityAt: Date;
  createdAt: Date;
}

export class MembersListResponseDto {
  total: number;
  skip: number;
  take: number;
  members: RoomMemberResponseDto[];
}

export class MemberPermissionsResponseDto {
  userId: string;
  roomId: string;
  role: MemberRole;
  permissions: string[];
  allActions: {
    canSendMessage: boolean;
    canEditMessage: boolean;
    canDeleteMessage: boolean;
    canKickMembers: boolean;
    canInviteMembers: boolean;
    canManageRoles: boolean;
    canChangeSettings: boolean;
    canViewAnalytics: boolean;
    canPinMessage: boolean;
    canManageInvitations: boolean;
  };
}
