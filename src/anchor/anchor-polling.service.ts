import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AnchorService } from './anchor.service';

@Injectable()
export class AnchorPollingService {
  private readonly logger = new Logger(AnchorPollingService.name);

  constructor(private readonly anchorService: AnchorService) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async pollPendingTransactions(): Promise<void> {
    this.logger.debug('Polling pending anchor transactions...');
    await this.anchorService.pollAllPending();
  }
}
