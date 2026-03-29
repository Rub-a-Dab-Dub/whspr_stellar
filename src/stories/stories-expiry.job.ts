import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StoriesRepository } from './stories.repository';

@Injectable()
export class StoriesExpiryJob {
  private readonly logger = new Logger(StoriesExpiryJob.name);

  constructor(private readonly storiesRepository: StoriesRepository) {}

  @Cron(CronExpression.EVERY_HOUR)
  async purgeExpired(): Promise<void> {
    const removed = await this.storiesRepository.deleteExpired();
    if (removed > 0) {
      this.logger.log(`Purged ${removed} expired stor(y|ies).`);
    }
  }
}
