import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomInvitation } from '../../room/entities/room-invitation.entity';
import { RoomMember } from '../../room/entities/room-member.entity';
import { User } from '../../user/entities/user.entity';

@Processor('member-notifications')
@Injectable()
export class MemberNotificationProcessor {
  private readonly logger = new Logger(MemberNotificationProcessor.name);

  constructor(
    @InjectRepository(RoomInvitation)
    private invitationRepository: Repository<RoomInvitation>,
    @InjectRepository(RoomMember)
    private memberRepository: Repository<RoomMember>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  @Process('send-invitation-notification')
  async sendInvitationNotification(
    job: Job<{
      invitationId: string;
      userId: string;
      roomId: string;
    }>,
  ): Promise<void> {
    try {
      const { invitationId, userId, roomId } = job.data;

      const invitation = await this.invitationRepository.findOne({
        where: { id: invitationId },
        relations: ['room', 'invitedBy'],
      });

      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (invitation && user) {
        // TODO: Send email notification
        this.logger.log(`Sending invitation notification to ${user.email}`);
        // Example: await this.emailService.sendInvitationEmail(user.email, invitation);
      }
    } catch (error) {
      this.logger.error('Error sending invitation notification', error);
      throw error;
    }
  }

  @Process('send-acceptance-notification')
  async sendAcceptanceNotification(
    job: Job<{
      invitationId: string;
      userId: string;
      roomId: string;
    }>,
  ): Promise<void> {
    try {
      const { invitationId, userId, roomId } = job.data;

      const invitation = await this.invitationRepository.findOne({
        where: { id: invitationId },
        relations: ['room', 'invitedBy'],
      });

      const member = await this.memberRepository.findOne({
        where: { userId, roomId },
        relations: ['user'],
      });

      if (invitation && member) {
        // TODO: Notify inviter that invitation was accepted
        this.logger.log(
          `User ${member.user.username} accepted invitation to ${invitation.room.name}`,
        );
        // Example: await this.emailService.sendAcceptanceNotification(invitation.invitedBy.email, member.user.username);
      }
    } catch (error) {
      this.logger.error('Error sending acceptance notification', error);
      throw error;
    }
  }

  @Process('send-rejection-notification')
  async sendRejectionNotification(
    job: Job<{
      invitationId: string;
      userId: string;
    }>,
  ): Promise<void> {
    try {
      const { invitationId, userId } = job.data;

      const invitation = await this.invitationRepository.findOne({
        where: { id: invitationId },
        relations: ['room', 'invitedBy'],
      });

      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (invitation && user) {
        // TODO: Notify inviter that invitation was rejected
        this.logger.log(
          `User ${user.username} rejected invitation to ${invitation.room.name}`,
        );
      }
    } catch (error) {
      this.logger.error('Error sending rejection notification', error);
      throw error;
    }
  }

  @Process('send-member-joined-notification')
  async sendMemberJoinedNotification(
    job: Job<{
      memberId: string;
      roomId: string;
    }>,
  ): Promise<void> {
    try {
      const { memberId, roomId } = job.data;

      const member = await this.memberRepository.findOne({
        where: { id: memberId },
        relations: ['user', 'room'],
      });

      if (member) {
        this.logger.log(`${member.user.username} joined ${member.room.name}`);
        // TODO: Broadcast to room members via WebSocket
      }
    } catch (error) {
      this.logger.error('Error sending member joined notification', error);
      throw error;
    }
  }

  @Process('send-role-change-notification')
  async sendRoleChangeNotification(
    job: Job<{
      memberId: string;
      oldRole: string;
      newRole: string;
      roomId: string;
    }>,
  ): Promise<void> {
    try {
      const { memberId, oldRole, newRole, roomId } = job.data;

      const member = await this.memberRepository.findOne({
        where: { id: memberId },
        relations: ['user', 'room'],
      });

      if (member) {
        this.logger.log(
          `${member.user.username}'s role changed from ${oldRole} to ${newRole} in ${member.room.name}`,
        );
        // TODO: Send notification to user
      }
    } catch (error) {
      this.logger.error('Error sending role change notification', error);
      throw error;
    }
  }
}
