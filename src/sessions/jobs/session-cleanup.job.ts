// src/sessions/jobs/session-cleanup.job.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SessionRepository } from '../repositories/session.repository';

@Injectable()
export class SessionCleanupJob {
  private readonly logger = new Logger(SessionCleanupJob.name);

  constructor(private readonly sessionRepository: SessionRepository) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredSessions() {
    this.logger.log('Starting cleanup of expired sessions...');
    
    try {
      const deletedCount = await this.sessionRepository.deleteExpiredSessions();
      this.logger.log(`Cleaned up ${deletedCount} expired sessions`);
    } catch (error) {
      this.logger.error('Failed to cleanup expired sessions', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupInactiveSessions() {
    this.logger.log('Starting cleanup of old inactive sessions...');
    
    try {
      const deletedCount = await this.sessionRepository.deleteInactiveSessions(30);
      this.logger.log(`Cleaned up ${deletedCount} old inactive sessions`);
    } catch (error) {
      this.logger.error('Failed to cleanup inactive sessions', error);
    }
  }
}