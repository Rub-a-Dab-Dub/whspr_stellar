import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RoomInvitationService } from '../services/room-invitation.service';
import { QueueService } from '../../queue/queue.service';

@Injectable()
export class InvitationExpirationJob {
  private readonly logger = new Logger(InvitationExpirationJob.name);

  constructor(
    private invitationService: RoomInvitationService,
    private queueService: QueueService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleInvitationExpiration(): Promise<void> {
    try {
      this.logger.debug('Starting invitation expiration job');
      const expiredCount = await this.invitationService.expireOldInvitations();
      this.logger.log(`Expired ${expiredCount} old invitations`);

      // Queue cleanup of very old invitations (30 days+)
      await this.queueService.addJob('cleanup-old-invitations', {
        daysOld: 30,
      });
    } catch (error) {
      this.logger.error('Error in invitation expiration job', error);
    }
  }

  @Cron(CronExpression.EVERY_WEEK)
  async handleInactiveMembers(): Promise<void> {
    try {
      this.logger.debug('Starting inactive members check');
      // Queue job to check for inactive members
      await this.queueService.addJob('check-inactive-members', {
        inactiveDays: 30,
      });
    } catch (error) {
      this.logger.error('Error in inactive members check', error);
    }
  }

  @Cron(CronExpression.EVERY_MONTH)
  async handleActivityCleanup(): Promise<void> {
    try {
      this.logger.debug('Starting activity cleanup');
      // Queue job to clean old activity records
      await this.queueService.addJob('cleanup-old-activities', {
        daysOld: 90,
      });
    } catch (error) {
      this.logger.error('Error in activity cleanup', error);
    }
  }
}
