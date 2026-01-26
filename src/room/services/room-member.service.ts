import {import {



























































































































































































































































































}  }    await this.redisService.delete(`room:${roomId}:members`);    await this.redisService.delete(`room:${roomId}:user:${userId}:permissions`);  private async invalidateMemberCache(roomId: string, userId: string): Promise<void> {  }    return await this.roomMemberRepository.findAdmins(roomId);  async getAdmins(roomId: string): Promise<RoomMember[]> {  }    return await this.roomMemberRepository.countMembers(roomId);  async getMemberCount(roomId: string): Promise<number> {  }    return await this.roomMemberRepository.isMember(roomId, userId);  async isMember(roomId: string, userId: string): Promise<boolean> {  }    }      await this.invalidateMemberCache(roomId, userId);      await this.roomMemberRepository.save(member);      member.lastActivityAt = new Date();    if (member) {    const member = await this.roomMemberRepository.findMemberWithRole(roomId, userId);  async recordMemberActivity(userId: string, roomId: string): Promise<void> {  }    };      memberCount,      canAdd: memberCount < maxMembers,    return {    const maxMembers = room.maxMembers || ROOM_MEMBER_CONSTANTS.DEFAULT_MAX_MEMBERS;    const memberCount = await this.roomMemberRepository.countMembers(roomId);    }      throw new NotFoundException(ERROR_MESSAGES.ROOM_NOT_FOUND);    if (!room) {    const room = await this.roomRepository.findOne({ where: { id: roomId } });  async validateMaxMembers(roomId: string): Promise<{ canAdd: boolean; memberCount: number }> {  }    return result;    );      ROOM_MEMBER_CONSTANTS.MEMBER_CACHE_TTL,      JSON.stringify(result),      cacheKey,    await this.redisService.set(    };      canPerformAction: (action: MemberPermission) => permissions.includes(action),      permissions: permissions as MemberPermission[],      role: member.role,    const result = {    const permissions = member.permissions || ROLE_PERMISSIONS[member.role];    }      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_IN_ROOM);    if (!member) {    const member = await this.roomMemberRepository.findMemberWithRole(roomId, userId);    }      return JSON.parse(cached);    if (cached) {    const cached = await this.redisService.get(cacheKey);    const cacheKey = `room:${roomId}:user:${userId}:permissions`;  }> {    canPerformAction: (action: MemberPermission) => boolean;    permissions: MemberPermission[];    role: MemberRole;  ): Promise<{    userId: string,    roomId: string,  async getMemberPermissions(  }    return updated;    await this.invalidateMemberCache(roomId, userId);    // Invalidate cache    const updated = await this.roomMemberRepository.save(member);    member.permissions = ROLE_PERMISSIONS[newRole];    member.role = newRole;    const oldRole = member.role;    }      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_IN_ROOM);    if (!member) {    const member = await this.roomMemberRepository.findMemberWithRole(roomId, userId);    }      throw new ForbiddenException(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS);    if (!initiator || initiator.role !== MemberRole.ADMIN) {    const initiator = await this.roomMemberRepository.findMemberWithRole(roomId, initiatorId);    // Check initiator is admin  ): Promise<RoomMember> {    initiatorId: string,    newRole: MemberRole,    userId: string,    roomId: string,  async updateMemberRole(  }    await this.invalidateMemberCache(roomId, userId);    // Invalidate cache    await this.roomMemberRepository.save(member);    member.kickReason = reason;    member.kickedBy = initiatorId;    member.kickedAt = new Date();    member.status = MemberStatus.REMOVED;    }      throw new ForbiddenException(ERROR_MESSAGES.CANNOT_KICK_ADMIN);    if (member.role === MemberRole.ADMIN && initiator.role !== MemberRole.ADMIN) {    // Cannot kick admin if not super admin    }      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_IN_ROOM);    if (!member) {    const member = await this.roomMemberRepository.findMemberWithRole(roomId, userId);    }      throw new BadRequestException(ERROR_MESSAGES.CANNOT_KICK_SELF);    if (userId === initiatorId) {    // Cannot kick self    }      throw new ForbiddenException(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS);    if (initiator.role === MemberRole.MEMBER) {    }      throw new ForbiddenException(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS);    if (!initiator) {    const initiator = await this.roomMemberRepository.findMemberWithRole(roomId, initiatorId);    // Check initiator permissions  ): Promise<void> {    reason?: string,    initiatorId: string,    userId: string,    roomId: string,  async kickMember(  }    return { total, members };    );      role,      take,      skip,      roomId,    const [members, total] = await this.roomMemberRepository.findRoomMembers(  ): Promise<{ total: number; members: RoomMember[] }> {    role?: MemberRole,    take: number = 20,    skip: number = 0,    roomId: string,  async getMembers(  }    await this.invalidateMemberCache(roomId, userId);    // Invalidate cache    await this.roomMemberRepository.save(member);    member.status = MemberStatus.INACTIVE;    }      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_IN_ROOM);    if (!member) {    const member = await this.roomMemberRepository.findMemberWithRole(roomId, userId);  async leaveRoom(userId: string, roomId: string): Promise<void> {  }    }      await queryRunner.release();    } finally {      throw error;      await queryRunner.rollbackTransaction();    } catch (error) {      return member;      await this.invalidateMemberCache(roomId, userId);      // Invalidate cache      await queryRunner.commitTransaction();      }        member = await queryRunner.manager.save(member);        member.joinedAt = new Date();        member.permissions = ROLE_PERMISSIONS[MemberRole.MEMBER];        member.inviteStatus = 'ACCEPTED';        member.status = MemberStatus.ACTIVE;        member.role = MemberRole.MEMBER;        member.userId = userId;        member.roomId = roomId;        member = new RoomMember();      } else {        member = await queryRunner.manager.save(existingMember);        existingMember.joinedAt = new Date();        existingMember.status = MemberStatus.ACTIVE;      if (existingMember) {      let member: RoomMember;    try {    await queryRunner.startTransaction();    await queryRunner.connect();    const queryRunner = this.dataSource.createQueryRunner();    // Create or update member record    }      }        throw new BadRequestException(ERROR_MESSAGES.INVALID_INVITE_TOKEN);      if (!member) {      const member = await this.roomMemberRepository.findByInviteToken(inviteToken);    if (inviteToken) {    // If invitation token is provided, validate it    }      throw new BadRequestException(ERROR_MESSAGES.MAX_MEMBERS_REACHED);    if (memberCount >= maxMembers) {    const maxMembers = room.maxMembers || ROOM_MEMBER_CONSTANTS.DEFAULT_MAX_MEMBERS;    const memberCount = await this.roomMemberRepository.countMembers(roomId);    // Check max members limit    }      throw new BadRequestException(ERROR_MESSAGES.ALREADY_IN_ROOM);    if (existingMember && existingMember.status === MemberStatus.ACTIVE) {    );      userId,      roomId,    const existingMember = await this.roomMemberRepository.findMemberWithRole(    // Check if user is already a member    }      throw new NotFoundException(ERROR_MESSAGES.ROOM_NOT_FOUND);    if (!room) {    const room = await this.roomRepository.findOne({ where: { id: roomId } });    // Check if room exists    }      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);    if (!user) {    const user = await this.userRepository.findOne({ where: { id: userId } });    // Check if user exists  async joinRoom(userId: string, roomId: string, inviteToken?: string): Promise<RoomMember> {  ) {}    private dataSource: DataSource,    private redisService: RedisService,    private userRepository: any,    @InjectRepository(User)    private roomRepository: any,    @InjectRepository(Room)    private roomMemberRepository: RoomMemberRepository,    @InjectRepository(RoomMember)  constructor(export class RoomMemberService {@Injectable()} from '../constants/room-member.constants';  ERROR_MESSAGES,  MemberPermission,  ROLE_PERMISSIONS,  ROOM_MEMBER_CONSTANTS,import {import { RedisService } from '../../redis/redis.service';import { User } from '../../../user/entities/user.entity';import { Room } from '../entities/room.entity';import { RoomMemberRepository } from '../repositories/room-member.repository';import { RoomMember, MemberRole, MemberStatus } from '../entities/room-member.entity';import { DataSource } from 'typeorm';import { InjectRepository } from '@nestjs/typeorm';} from '@nestjs/common';  ForbiddenException,  NotFoundException,  BadRequestException,  Injectable,  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RoomMember, MemberRole, MemberStatus } from '../entities/room-member.entity';
import { RoomMemberRepository } from '../repositories/room-member.repository';
import { Room } from '../entities/room.entity';
import { User } from '../../../user/entities/user.entity';
import { RedisService } from '../../redis/redis.service';
import {
  ROOM_MEMBER_CONSTANTS,
  ROLE_PERMISSIONS,
  MemberPermission,
  ERROR_MESSAGES,
} from '../constants/room-member.constants';

@Injectable()
export class RoomMemberService {
  constructor(
    @InjectRepository(RoomMember)
    private roomMemberRepository: RoomMemberRepository,
    @InjectRepository(Room)
    private roomRepository: any,
    @InjectRepository(User)
    private userRepository: any,
    private redisService: RedisService,
    private dataSource: DataSource,
  ) {}

  async joinRoom(userId: string, roomId: string, inviteToken?: string): Promise<RoomMember> {
    // Check if user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    // Check if room exists
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException(ERROR_MESSAGES.ROOM_NOT_FOUND);
    }

    // Check if user is already a member
    const existingMember = await this.roomMemberRepository.findMemberWithRole(
      roomId,
      userId,
    );
    if (existingMember && existingMember.status === MemberStatus.ACTIVE) {
      throw new BadRequestException(ERROR_MESSAGES.ALREADY_IN_ROOM);
    }

    // Check max members limit
    const memberCount = await this.roomMemberRepository.countMembers(roomId);
    const maxMembers = room.maxMembers || ROOM_MEMBER_CONSTANTS.DEFAULT_MAX_MEMBERS;
    if (memberCount >= maxMembers) {
      throw new BadRequestException(ERROR_MESSAGES.MAX_MEMBERS_REACHED);
    }

    // If invitation token is provided, validate it
    if (inviteToken) {
      const member = await this.roomMemberRepository.findByInviteToken(inviteToken);
      if (!member) {
        throw new BadRequestException(ERROR_MESSAGES.INVALID_INVITE_TOKEN);
      }
    }

    // Create or update member record
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let member: RoomMember;

      if (existingMember) {
        existingMember.status = MemberStatus.ACTIVE;
        existingMember.joinedAt = new Date();
        member = await queryRunner.manager.save(existingMember);
      } else {
        member = new RoomMember();
        member.roomId = roomId;
        member.userId = userId;
        member.role = MemberRole.MEMBER;
        member.status = MemberStatus.ACTIVE;
        member.inviteStatus = 'ACCEPTED';
        member.permissions = ROLE_PERMISSIONS[MemberRole.MEMBER];
        member.joinedAt = new Date();
        member = await queryRunner.manager.save(member);
      }

      await queryRunner.commitTransaction();

      // Invalidate cache
      await this.invalidateMemberCache(roomId, userId);

      return member;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async leaveRoom(userId: string, roomId: string): Promise<void> {
    const member = await this.roomMemberRepository.findMemberWithRole(roomId, userId);
    if (!member) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_IN_ROOM);
    }

    member.status = MemberStatus.INACTIVE;
    await this.roomMemberRepository.save(member);

    // Invalidate cache
    await this.invalidateMemberCache(roomId, userId);
  }

  async getMembers(
    roomId: string,
    skip: number = 0,
    take: number = 20,
    role?: MemberRole,
  ): Promise<{ total: number; members: RoomMember[] }> {
    const [members, total] = await this.roomMemberRepository.findRoomMembers(
      roomId,
      skip,
      take,
      role,
    );

    return { total, members };
  }

  async kickMember(
    roomId: string,
    userId: string,
    initiatorId: string,
    reason?: string,
  ): Promise<void> {
    // Check initiator permissions
    const initiator = await this.roomMemberRepository.findMemberWithRole(roomId, initiatorId);
    if (!initiator) {
      throw new ForbiddenException(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS);
    }

    if (initiator.role === MemberRole.MEMBER) {
      throw new ForbiddenException(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS);
    }

    // Cannot kick self
    if (userId === initiatorId) {
      throw new BadRequestException(ERROR_MESSAGES.CANNOT_KICK_SELF);
    }

    const member = await this.roomMemberRepository.findMemberWithRole(roomId, userId);
