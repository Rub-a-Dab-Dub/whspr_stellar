import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RoomPaymentService } from '../services/room-payment.service';

@Injectable()
export class PaymentExpirationJob {
  private readonly logger = new Logger(PaymentExpirationJob.name);

  constructor(private roomPaymentService: RoomPaymentService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handlePaymentExpiration() {
    this.logger.log('Running payment expiration check...');

    try {
      await this.roomPaymentService.expireOldPayments();
      this.logger.log('Payment expiration check completed');
    } catch (error) {
      this.logger.error('Failed to expire payments', error.stack);
    }
  }
}
