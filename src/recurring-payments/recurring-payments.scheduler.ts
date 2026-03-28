import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RecurringPaymentsService } from './recurring-payments.service';

@Injectable()
export class RecurringPaymentsScheduler {
  private readonly logger = new Logger(RecurringPaymentsScheduler.name);

  constructor(private readonly service: RecurringPaymentsService) {}

  /** Process due payments every 5 minutes */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async processDue(): Promise<void> {
    this.logger.debug('Running due recurring payments...');
    await this.service.processDue();
  }

  /** Notify senders 24h before next run — runs every hour */
  @Cron(CronExpression.EVERY_HOUR)
  async notifyUpcoming(): Promise<void> {
    this.logger.debug('Checking upcoming recurring payments for 24h notifications...');
    await this.service.notifyUpcoming();
  }
}
