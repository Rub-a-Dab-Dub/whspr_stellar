import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomMember, MemberRole } from '../entities/room-member.entity';
import {
  ROLE_PERMISSIONS,
  MemberPermission,
  ERROR_MESSAGES,
} from '../constants/room-member.constants';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class MemberPermissionsService {
  constructor(
    @InjectRepository(RoomMember)
    private memberRepository: Repository<RoomMember>,
    private redisService: RedisService,
  ) {}

  async checkPermission(
    userId: string,
    roomId: string,
    action: MemberPermission,
  ): Promise<boolean> {
    const cacheKey = `perm:${userId}:${roomId}`;
    const cached = await this.redisService.get(cacheKey);

    let member: RoomMember;

    if (cached) {
      member = JSON.parse(cached);
    } else {
      member = await this.memberRepository.findOne({
        where: { userId, roomId },
      });

      if (!member) {
        return false;
      }

      await this.redisService.set(cacheKey, JSON.stringify(member), 300);
    }

    const permissions = member.permissions || this.getDefaultPermissions(member.role);
    return permissions.includes(action);
  }

  async verifyPermissionOrFail(
    userId: string,
    roomId: string,
    action: MemberPermission,
  ): Promise<void> {
    const hasPermission = await this.checkPermission(userId, roomId, action);

    if (!hasPermission) {
      throw new ForbiddenException(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS);
    }
  }

  getDefaultPermissions(role: MemberRole): MemberPermission[] {
    return ROLE_PERMISSIONS[role] || [];
  }

  async assignPermissions(
    roomId: string,
    userId: string,
    permissions: MemberPermission[],
    initiatorId: string,
  ): Promise<RoomMember> {
    // Check initiator is admin
    const initiator = await this.memberRepository.findOne({
      where: { userId: initiatorId, roomId },
    });

    if (!initiator || ![MemberRole.ADMIN, MemberRole.OWNER].includes(initiator.role)) {
      throw new ForbiddenException(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS);
    }

    const member = await this.memberRepository.findOne({
      where: { userId, roomId },
    });

    if (!member) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_IN_ROOM);
    }

    member.permissions = permissions;
    const updated = await this.memberRepository.save(member);

    // Invalidate cache
    await this.redisService.delete(`perm:${userId}:${roomId}`);

    return updated;
  }

  async revokePermission(
    roomId: string,
    userId: string,
    permission: MemberPermission,
    initiatorId: string,
  ): Promise<RoomMember> {
    const initiator = await this.memberRepository.findOne({
      where: { userId: initiatorId, roomId },
    });

    if (!initiator || ![MemberRole.ADMIN, MemberRole.OWNER].includes(initiator.role)) {
      throw new ForbiddenException(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS);
    }

    const member = await this.memberRepository.findOne({
      where: { userId, roomId },
    });

    if (!member) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_IN_ROOM);
    }

    const permissions = member.permissions || this.getDefaultPermissions(member.role);
    member.permissions = permissions.filter((p) => p !== permission);
    const updated = await this.memberRepository.save(member);

    // Invalidate cache
    await this.redisService.delete(`perm:${userId}:${roomId}`);

    return updated;
  }

  async grantPermission(
    roomId: string,
    userId: string,
    permission: MemberPermission,
    initiatorId: string,
  ): Promise<RoomMember> {
    const initiator = await this.memberRepository.findOne({
      where: { userId: initiatorId, roomId },
    });

    if (!initiator || ![MemberRole.ADMIN, MemberRole.OWNER].includes(initiator.role)) {
      throw new ForbiddenException(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS);
    }

    const member = await this.memberRepository.findOne({
      where: { userId, roomId },
    });

    if (!member) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_IN_ROOM);
    }

    const permissions = member.permissions || this.getDefaultPermissions(member.role);
    if (!permissions.includes(permission)) {
      permissions.push(permission);
      member.permissions = permissions;
    }

    const updated = await this.memberRepository.save(member);

    // Invalidate cache
    await this.redisService.delete(`perm:${userId}:${roomId}`);

    return updated;
  }

  async updatePermissionsByRole(
    roomId: string,
    role: MemberRole,
    permissions: MemberPermission[],
    initiatorId: string,
  ): Promise<number> {
    // Check initiator is admin
    const initiator = await this.memberRepository.findOne({
      where: { userId: initiatorId, roomId },
    });

    if (!initiator || ![MemberRole.ADMIN, MemberRole.OWNER].includes(initiator.role)) {
      throw new ForbiddenException(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS);
    }

    // Get all members with this role
    const members = await this.memberRepository.find({
      where: { roomId, role },
    });

    // Update their permissions
    for (const member of members) {
      member.permissions = permissions;
      await this.memberRepository.save(member);
      await this.redisService.delete(`perm:${member.userId}:${roomId}`);
    }

    return members.length;
  }

  async getAllPermissions(): Promise<string[]> {
    return Object.values(MemberPermission);
  }

  async getMemberActions(
    userId: string,
    roomId: string,
  ): Promise<Record<string, boolean>> {
    const permissions = await this.memberRepository
      .findOne({ where: { userId, roomId } })
      .then((m) => m?.permissions || this.getDefaultPermissions(m?.role || MemberRole.MEMBER));

    return {
      canSendMessage: permissions.includes(MemberPermission.SEND_MESSAGE),
      canEditMessage: permissions.includes(MemberPermission.EDIT_MESSAGE),
      canDeleteMessage: permissions.includes(MemberPermission.DELETE_MESSAGE),
      canKickMembers: permissions.includes(MemberPermission.KICK_MEMBERS),
      canInviteMembers: permissions.includes(MemberPermission.INVITE_MEMBERS),
      canManageRoles: permissions.includes(MemberPermission.MANAGE_ROLES),
      canChangeSettings: permissions.includes(MemberPermission.CHANGE_ROOM_SETTINGS),
      canViewAnalytics: permissions.includes(MemberPermission.VIEW_ANALYTICS),
      canPinMessage: permissions.includes(MemberPermission.PIN_MESSAGE),
      canManageInvitations: permissions.includes(MemberPermission.MANAGE_INVITATIONS),
    };
  }

  async resetToDefaultPermissions(
    roomId: string,
    userId: string,
    initiatorId: string,
  ): Promise<RoomMember> {
    const initiator = await this.memberRepository.findOne({
      where: { userId: initiatorId, roomId },
    });

    if (!initiator || ![MemberRole.ADMIN, MemberRole.OWNER].includes(initiator.role)) {
      throw new ForbiddenException(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS);
    }

    const member = await this.memberRepository.findOne({
      where: { userId, roomId },
    });

    if (!member) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_IN_ROOM);
    }

    member.permissions = this.getDefaultPermissions(member.role);
    const updated = await this.memberRepository.save(member);

    // Invalidate cache
    await this.redisService.delete(`perm:${userId}:${roomId}`);

    return updated;
  }
}
