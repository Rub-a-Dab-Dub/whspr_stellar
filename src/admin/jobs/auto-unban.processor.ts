import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Job } from 'bull';
import { QUEUE_NAMES } from '../../queue/queue.constants';
import { User } from '../../user/entities/user.entity';

@Processor(QUEUE_NAMES.NOTIFICATIONS)
export class AutoUnbanProcessor {
  private readonly logger = new Logger(AutoUnbanProcessor.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @Process('auto-unban-user')
  async handleAutoUnban(job: Job<{ userId: string; expiresAt: Date }>) {
    this.logger.log(`Processing auto-unban job for user ${job.data.userId}`);

    try {
      const { userId, expiresAt } = job.data;

      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        this.logger.warn(`User ${userId} not found for auto-unban`);
        return;
      }

      if (!user.isBanned) {
        this.logger.log(`User ${userId} is not banned, skipping auto-unban`);
        return;
      }

      // Check if ban has expired
      const now = new Date();
      if (user.banExpiresAt && user.banExpiresAt > now) {
        this.logger.log(
          `User ${userId} ban has not expired yet (expires at ${user.banExpiresAt})`,
        );
        return;
      }

      // Auto-unban the user
      user.isBanned = false;
      user.bannedAt = null;
      user.bannedBy = null;
      user.banReason = null;
      user.banExpiresAt = null;

      await this.userRepository.save(user);

      this.logger.log(
        `Auto-unbanned user ${userId} after temporary ban expired`,
      );

      await job.progress(100);
    } catch (error) {
      this.logger.error(
        `Error processing auto-unban job for user ${job.data.userId}:`,
        error,
      );
      throw error;
    }
  }
}
