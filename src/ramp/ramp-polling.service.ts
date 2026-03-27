import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { RampService } from './ramp.service';

const POLL_INTERVAL_MS = 30_000;

@Injectable()
export class RampPollingService {
  private readonly logger = new Logger(RampPollingService.name);

  constructor(private readonly rampService: RampService) {}

  @Interval(POLL_INTERVAL_MS)
  async pollRampTransactions(): Promise<void> {
    try {
      await this.rampService.pollPendingTransactions();
    } catch (err) {
      this.logger.error('Ramp polling error', (err as Error).message);
    }
  }
}
