import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AlertsService {
  private logger = new Logger(AlertsService.name);
  async sendHighValueAlert(payload: { traceId: string; usdValue: number; txHash?: string }) {
    // implement webhook, email, or push notification here
    this.logger.warn(`ALERT: high-value tx ${payload.traceId} USD ${payload.usdValue} txHash=${payload.txHash}`);
  }

  async sendFraudAlert(payload: any) {
    this.logger.warn('FRAUD ALERT', payload);
  }
}
