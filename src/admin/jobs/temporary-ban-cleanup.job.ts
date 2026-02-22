import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { User } from '../../user/entities/user.entity';

/**
 * Scheduled job that runs every 5 minutes to auto-lift temporary bans
 * that have expired.
 */
@Injectable()
export class TemporaryBanCleanupJob {
  private readonly logger = new Logger(TemporaryBanCleanupJob.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @Cron('*/5 * * * *') // Every 5 minutes
  async handleTemporaryBanCleanup() {
    this.logger.log('Running temporary ban cleanup job');

    try {
      const now = new Date();

      // Find all users with expired temporary bans
      const expiredBans = await this.userRepository.find({
        where: {
          isBanned: true,
          banExpiresAt: LessThanOrEqual(now),
        },
      });

      if (expiredBans.length === 0) {
        this.logger.debug('No expired temporary bans found');
        return;
      }

      this.logger.log(
        `Found ${expiredBans.length} expired temporary ban(s) to auto-lift`,
      );

      // Auto-unban all expired temporary bans
      for (const user of expiredBans) {
        user.isBanned = false;
        user.bannedAt = null;
        user.bannedBy = null;
        user.banReason = null;
        user.banExpiresAt = null;

        await this.userRepository.save(user);

        this.logger.log(
          `Auto-unbanned user ${user.id} after temporary ban expired`,
        );
      }

      this.logger.log(
        `Successfully auto-unbanned ${expiredBans.length} user(s)`,
      );
    } catch (error) {
      this.logger.error('Error in temporary ban cleanup job:', error);
    }
  }
}
