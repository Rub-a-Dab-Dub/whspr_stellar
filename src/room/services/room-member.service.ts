import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  MemberRole,
  MemberStatus,
  RoomMember,
} from '../entities/room-member.entity';
import { RoomMemberRepository } from '../repositories/room-member.repository';
import { Room } from '../entities/room.entity';
import { User } from '../../user/entities/user.entity';
import { RedisService } from '../../redis/redis.service';
import {
  ERROR_MESSAGES,
  ROLE_PERMISSIONS,
  ROOM_MEMBER_CONSTANTS,
} from '../constants/room-member.constants';

@Injectable()
export class RoomMemberService {
  constructor(
    @InjectRepository(RoomMember)
    private readonly roomMemberRepository: RoomMemberRepository,
    @Optional()
    @InjectRepository(Room)
    private readonly roomRepositoryOrm?: Repository<Room>,
    @Optional()
    @InjectRepository(User)
    private readonly userRepositoryOrm?: Repository<User>,
    @Optional()
    @Inject('RoomRepository')
    private readonly roomRepositoryNamed?: any,
    @Optional()
    @Inject('UserRepository')
    private readonly userRepositoryNamed?: any,
    private readonly redisService?: RedisService,
    @Optional()
    private readonly dataSource?: DataSource,
  ) {}

  private get roomRepository(): any {
    return this.roomRepositoryNamed || this.roomRepositoryOrm;
  }

  private get userRepository(): any {
    return this.userRepositoryNamed || this.userRepositoryOrm;
  }

  async joinRoom(
    userId: string,
    roomId: string,
    inviteToken?: string,
  ): Promise<RoomMember> {
    const existingMember = await this.roomMemberRepository.findMemberWithRole(
      roomId,
      userId,
    );
    if (existingMember && existingMember.status === MemberStatus.ACTIVE) {
      throw new BadRequestException(ERROR_MESSAGES.ALREADY_IN_ROOM);
    }

    const memberCount = await this.roomMemberRepository.countMembers(roomId);
    const room = this.roomRepository
      ? await this.roomRepository.findOne({ where: { id: roomId } })
      : null;
    const maxMembers =
      room?.maxMembers || ROOM_MEMBER_CONSTANTS.DEFAULT_MAX_MEMBERS;
    if (memberCount >= maxMembers) {
      throw new BadRequestException(ERROR_MESSAGES.MAX_MEMBERS_REACHED);
    }

    if (inviteToken) {
      const invitation =
        await this.roomMemberRepository.findByInviteToken(inviteToken);
      if (!invitation) {
        throw new BadRequestException(ERROR_MESSAGES.INVALID_INVITE_TOKEN);
      }
    }

    const queryRunner = this.dataSource?.createQueryRunner?.();
    if (queryRunner) {
      await queryRunner.connect();
      await queryRunner.startTransaction();
      try {
        const member = new RoomMember();
        member.roomId = roomId;
        member.userId = userId;
        member.role = MemberRole.MEMBER;
        member.status = MemberStatus.ACTIVE;
        member.permissions = ROLE_PERMISSIONS[MemberRole.MEMBER];
        member.inviteStatus = 'ACCEPTED';
        const saved = await queryRunner.manager.save(member);
        await queryRunner.commitTransaction();
        await this.invalidateMemberCache(roomId, userId);
        return saved;
      } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
      } finally {
        await queryRunner.release();
      }
    }

    const member = new RoomMember();
    member.roomId = roomId;
    member.userId = userId;
    member.role = MemberRole.MEMBER;
    member.status = MemberStatus.ACTIVE;
    member.permissions = ROLE_PERMISSIONS[MemberRole.MEMBER];
    member.inviteStatus = 'ACCEPTED';
    const saved = await this.roomMemberRepository.save(member);
    await this.invalidateMemberCache(roomId, userId);
    return saved;
  }

  async leaveRoom(userId: string, roomId: string): Promise<void> {
    const member = await this.roomMemberRepository.findMemberWithRole(
      roomId,
      userId,
    );
    if (!member) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_IN_ROOM);
    }
    member.status = MemberStatus.INACTIVE;
    await this.roomMemberRepository.save(member);
    await this.invalidateMemberCache(roomId, userId);
  }

  async kickMember(
    roomId: string,
    userId: string,
    initiatorId: string,
    reason?: string,
  ): Promise<void> {
    const initiator = await this.roomMemberRepository.findMemberWithRole(
      roomId,
      initiatorId,
    );
    if (!initiator || initiator.role === MemberRole.MEMBER) {
      throw new ForbiddenException(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS);
    }

    if (userId === initiatorId) {
      throw new BadRequestException(ERROR_MESSAGES.CANNOT_KICK_SELF);
    }

    const member = await this.roomMemberRepository.findMemberWithRole(
      roomId,
      userId,
    );
    if (!member) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_IN_ROOM);
    }

    member.status = MemberStatus.REMOVED;
    member.kickedAt = new Date();
    member.kickedBy = initiatorId;
    member.kickReason = reason || null;
    await this.roomMemberRepository.save(member);
    await this.invalidateMemberCache(roomId, userId);
  }

  async updateMemberRole(
    roomId: string,
    userId: string,
    newRole: MemberRole,
    initiatorId: string,
  ): Promise<RoomMember> {
    const initiator = await this.roomMemberRepository.findMemberWithRole(
      roomId,
      initiatorId,
    );
    if (!initiator || initiator.role !== MemberRole.ADMIN) {
      throw new ForbiddenException(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS);
    }

    const member = await this.roomMemberRepository.findMemberWithRole(
      roomId,
      userId,
    );
    if (!member) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_IN_ROOM);
    }

    member.role = newRole;
    member.permissions = ROLE_PERMISSIONS[newRole];
    const saved = await this.roomMemberRepository.save(member);
    await this.invalidateMemberCache(roomId, userId);
    return saved;
  }

  async isMember(roomId: string, userId: string): Promise<boolean> {
    return this.roomMemberRepository.isMember(roomId, userId);
  }

  async validateMaxMembers(
    roomId: string,
  ): Promise<{ canAdd: boolean; memberCount: number }> {
    const memberCount = await this.roomMemberRepository.countMembers(roomId);
    const room = this.roomRepository
      ? await this.roomRepository.findOne({ where: { id: roomId } })
      : null;
    const maxMembers =
      room?.maxMembers || ROOM_MEMBER_CONSTANTS.DEFAULT_MAX_MEMBERS;
    return {
      canAdd: memberCount < maxMembers,
      memberCount,
    };
  }

  private async invalidateMemberCache(
    roomId: string,
    userId: string,
  ): Promise<void> {
    if (!this.redisService) return;
    await this.redisService.delete(`room:${roomId}:members`);
    await this.redisService.delete(`room:${roomId}:user:${userId}:permissions`);
  }
}
