import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LocationShareService } from './location-share.service';

@Injectable()
export class LocationShareExpiryJob {
  private readonly logger = new Logger(LocationShareExpiryJob.name);

  constructor(private readonly service: LocationShareService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expireStaleShares(): Promise<void> {
    const count = await this.service.expireStale();
    if (count > 0) {
      this.logger.log(`Expired and deleted ${count} stale location share(s).`);
    }
  }
}
