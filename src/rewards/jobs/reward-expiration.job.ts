import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RewardsService } from '../services/rewards.service';

@Injectable()
export class RewardExpirationJob {
  private readonly logger = new Logger(RewardExpirationJob.name);

  constructor(private readonly rewardsService: RewardsService) {}

  /**
   * Process expired rewards every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleExpiredRewards() {
    this.logger.log('Processing expired rewards...');
    try {
      const count = await this.rewardsService.processExpiredRewards();
      this.logger.log(`Processed ${count} expired rewards`);
    } catch (error) {
      this.logger.error('Error processing expired rewards:', error);
    }
  }
}
