import { IsUUID, IsArray, IsOptional, IsString, IsEmail, MinLength, ArrayMinSize } from 'class-validator';
import { InvitationStatus } from '../entities/room-invitation.entity';

export class InviteMemberDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  userIds: string[];

  @IsOptional()
  @IsString()
  @MinLength(1)
  message?: string;
}

export class InviteByEmailDto {
  @IsArray()
  @IsEmail({}, { each: true })
  @ArrayMinSize(1)
  emails: string[];

  @IsOptional()
  @IsString()
  @MinLength(1)
  message?: string;
}

export class InvitationResponseDto {
  @IsString()
  invitationId: string;

  @IsString()
  status: 'ACCEPTED' | 'REJECTED';

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ResendInvitationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  message?: string;
}

export class RoomInvitationDetailsDto {
  id: string;
  roomId: string;
  roomName: string;
  roomDescription: string;
  room: {
    id: string;
    name: string;
    description?: string;
    avatar?: string;
  };
  invitedById: string;
  invitedBy: {
    id: string;
    username: string;
    avatar?: string;
  };
  invitedUserId?: string;
  invitedEmail?: string;
  status: InvitationStatus;
  message?: string;
  expiresAt: Date;
  createdAt: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  inviteToken: string;
}

export class PendingInvitationsDto {
  total: number;
  skip: number;
  take: number;
  invitations: RoomInvitationDetailsDto[];
}

export class AcceptInvitationDto {
  @IsString()
  invitationId: string;
}

export class RejectInvitationDto {
  @IsString()
  invitationId: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  reason?: string;
}
