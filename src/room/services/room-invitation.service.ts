import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  RoomInvitation,
  InvitationStatus,
} from '../entities/room-invitation.entity';
import { RoomMember, MemberRole } from '../entities/room-member.entity';
import { RoomInvitationRepository } from '../repositories/room-invitation.repository';
import { Room } from '../entities/room.entity';
import { User } from '../../user/entities/user.entity';
import { QueueService } from '../../queue/queue.service';
import { RedisService } from '../../redis/redis.service';
import {
  ROOM_MEMBER_CONSTANTS,
  INVITATION_CONFIG,
  ERROR_MESSAGES,
} from '../constants/room-member.constants';
import * as crypto from 'crypto';

@Injectable()
export class RoomInvitationService {
  constructor(
    @InjectRepository(RoomInvitation)
    private invitationRepository: RoomInvitationRepository,
    @InjectRepository(RoomMember)
    private memberRepository: any,
    @InjectRepository(Room)
    private roomRepository: any,
    @InjectRepository(User)
    private userRepository: any,
    private queueService: QueueService,
    private redisService: RedisService,
    private dataSource: DataSource,
  ) {}

  async inviteMembers(
    roomId: string,
    userIds: string[],
    invitedById: string,
    message?: string,
  ): Promise<RoomInvitation[]> {
    // Verify room exists
    const room = await this.roomRepository.findOne({ where: { id: roomId } });
    if (!room) {
      throw new NotFoundException(ERROR_MESSAGES.ROOM_NOT_FOUND);
    }

    // Check inviter has permission
    const inviter = await this.memberRepository.findMemberWithRole(
      roomId,
      invitedById,
    );
    if (!inviter) {
      throw new ForbiddenException(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS);
    }

    if (inviter.role === MemberRole.MEMBER) {
      throw new ForbiddenException(ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS);
    }

    // Check rate limit
    const sinceTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sentToday = await this.invitationRepository.countSentByUser(
      invitedById,
      sinceTime,
    );
    if (
      sentToday + userIds.length >
      INVITATION_CONFIG.MAX_INVITATIONS_PER_DAY
    ) {
      throw new BadRequestException(
        `Too many invitations sent today. Limit: ${INVITATION_CONFIG.MAX_INVITATIONS_PER_DAY}`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const invitations: RoomInvitation[] = [];

      for (const userId of userIds) {
        // Check user exists
        const user = await this.userRepository.findOne({
          where: { id: userId },
        });
        if (!user) {
          continue;
        }

        // Check if already a member
        const existingMember = await this.memberRepository.findMemberWithRole(
          roomId,
          userId,
        );
        if (existingMember) {
          continue;
        }

        // Check for existing pending invitation
        const existingInvitation =
          await this.invitationRepository.findByUserAndRoom(userId, roomId);
        if (existingInvitation) {
          continue;
        }

        const inviteToken = this.generateInviteToken();
        const expiresAt = new Date();
        expiresAt.setDate(
          expiresAt.getDate() + ROOM_MEMBER_CONSTANTS.INVITATION_EXPIRY_DAYS,
        );

        const invitation = new RoomInvitation();
        invitation.roomId = roomId;
        invitation.invitedById = invitedById;
        invitation.invitedUserId = userId;
        invitation.status = InvitationStatus.PENDING;
        invitation.inviteToken = inviteToken;
        invitation.message = message;
        invitation.expiresAt = expiresAt;

        const saved = await queryRunner.manager.save(invitation);
        invitations.push(saved);

        // Queue notification email
        await this.queueService.addJob('send-invitation-notification', {
          invitationId: saved.id,
          userId,
          roomId,
        });
      }

      await queryRunner.commitTransaction();
      return invitations;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getPendingInvitations(
    userId: string,
    skip: number = 0,
    take: number = 20,
  ): Promise<{ total: number; invitations: RoomInvitation[] }> {
    const [invitations, total] =
      await this.invitationRepository.findPendingInvitations(
        userId,
        skip,
        take,
      );

    return { total, invitations };
  }

  async acceptInvitation(
    invitationId: string,
    userId: string,
  ): Promise<RoomMember> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId },
      relations: ['room', 'invitedBy'],
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.invitedUserId !== userId) {
      throw new ForbiddenException('This invitation is not for you');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(
        `Invitation has already been ${invitation.status.toLowerCase()}`,
      );
    }

    if (new Date() > invitation.expiresAt) {
      invitation.status = InvitationStatus.EXPIRED;
      await this.invitationRepository.save(invitation);
      throw new BadRequestException(ERROR_MESSAGES.INVITATION_EXPIRED);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update invitation
      invitation.status = InvitationStatus.ACCEPTED;
      invitation.acceptedAt = new Date();
      await queryRunner.manager.save(invitation);

      // Add member to room
      const member = new RoomMember();
      member.roomId = invitation.roomId;
      member.userId = userId;
      member.role = MemberRole.MEMBER;
      member.inviteStatus = 'ACCEPTED';
      const saved = await queryRunner.manager.save(member);

      await queryRunner.commitTransaction();

      // Queue notification
      await this.queueService.addJob('send-acceptance-notification', {
        invitationId: invitation.id,
        userId,
        roomId: invitation.roomId,
      });

      return saved;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async rejectInvitation(
    invitationId: string,
    userId: string,
    reason?: string,
  ): Promise<void> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.invitedUserId !== userId) {
      throw new ForbiddenException('This invitation is not for you');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(
        `Invitation has already been ${invitation.status.toLowerCase()}`,
      );
    }

    invitation.status = InvitationStatus.REJECTED;
    invitation.rejectedAt = new Date();
    invitation.rejectionReason = reason;
    await this.invitationRepository.save(invitation);

    // Queue notification
    await this.queueService.addJob('send-rejection-notification', {
      invitationId: invitation.id,
      userId,
    });
  }

  async getInvitationByToken(token: string): Promise<RoomInvitation | null> {
    const invitation = await this.invitationRepository.findByToken(token);

    if (!invitation) {
      return null;
    }

    if (
      invitation.status !== InvitationStatus.PENDING ||
      new Date() > invitation.expiresAt
    ) {
      return null;
    }

    return invitation;
  }

  async expireOldInvitations(): Promise<number> {
    const expired = await this.invitationRepository.findExpired();

    for (const invitation of expired) {
      invitation.status = InvitationStatus.EXPIRED;
      await this.invitationRepository.save(invitation);
    }

    return expired.length;
  }

  async resendInvitation(
    invitationId: string,
    initiatorId: string,
    message?: string,
  ): Promise<RoomInvitation> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.invitedById !== initiatorId) {
      throw new ForbiddenException('You did not send this invitation');
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Can only resend pending invitations');
    }

    // Check resend cooldown
    const lastSent = invitation.updatedAt;
    const cooldown = INVITATION_CONFIG.RESEND_COOLDOWN_MINUTES * 60 * 1000;
    const now = new Date();

    if (now.getTime() - lastSent.getTime() < cooldown) {
      throw new BadRequestException(
        `Please wait ${INVITATION_CONFIG.RESEND_COOLDOWN_MINUTES} minutes before resending`,
      );
    }

    if (message) {
      invitation.message = message;
    }

    invitation.updatedAt = new Date();
    const updated = await this.invitationRepository.save(invitation);

    // Queue notification
    await this.queueService.addJob('send-invitation-notification', {
      invitationId: updated.id,
      userId: updated.invitedUserId,
      roomId: updated.roomId,
    });

    return updated;
  }

  async getRoomInvitations(
    roomId: string,
    status?: InvitationStatus,
    skip: number = 0,
    take: number = 20,
  ): Promise<{ total: number; invitations: RoomInvitation[] }> {
    const [invitations, total] =
      await this.invitationRepository.findRoomInvitations(
        roomId,
        status,
        skip,
        take,
      );

    return { total, invitations };
  }

  async revokeInvitation(
    invitationId: string,
    initiatorId: string,
  ): Promise<void> {
    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.invitedById !== initiatorId) {
      throw new ForbiddenException('You did not send this invitation');
    }

    invitation.status = InvitationStatus.REVOKED;
    await this.invitationRepository.save(invitation);
  }

  private generateInviteToken(): string {
    return crypto
      .randomBytes(INVITATION_CONFIG.TOKEN_LENGTH / 2)
      .toString('hex');
  }
}
