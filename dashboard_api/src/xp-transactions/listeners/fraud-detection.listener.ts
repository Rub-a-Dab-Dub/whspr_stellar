import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FraudDetectionListener {
  private readonly logger = new Logger(FraudDetectionListener.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  @OnEvent('fraud.detected')
  async handleFraudDetection(payload: any) {
    this.logger.warn(`Fraud alert: User ${payload.userId} earned ${payload.xpAmount} XP`);

    const adminEmails = this.configService.get<string>('ADMIN_EMAILS', '').split(',');

    if (adminEmails.length > 0) {
      try {
        await this.mailerService.sendMail({
          to: adminEmails,
          subject: '🚨 XP Fraud Alert',
          html: `
            <h2>Suspicious Activity Detected</h2>
            <p>User: ${payload.userId}</p>
            <p>XP Earned: ${payload.xpAmount} in 1 hour</p>
            <p>Threshold: ${payload.threshold}</p>
          `,
        });
      } catch (error) {
        this.logger.error(`Failed to send fraud alert: ${error.message}`);
      }
    }
  }
}
