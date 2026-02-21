import { Injectable, Logger } from '@nestjs/common';

export interface NotificationPayload {
  userId: string;
  username: string;
  type: 'WITHDRAWAL_APPROVED' | 'WITHDRAWAL_REJECTED' | 'WITHDRAWAL_QUEUED';
  amount: number;
  chain: string;
  walletAddress: string;
  reason?: string;
  txHash?: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  async notifyUser(payload: NotificationPayload): Promise<void> {
    // In production, integrate with email/push/SMS provider (e.g., SendGrid, Firebase, Twilio)
    this.logger.log(
      `[NOTIFY] user=${payload.username} type=${payload.type} ` +
        `amount=${payload.amount} ${payload.chain}`,
    );

    // Example: emit to a queue (RabbitMQ/Kafka) or call email service
    // await this.emailService.send({ to: user.email, template: payload.type, data: payload });
    // await this.pushService.send({ userId: payload.userId, ...payload });
  }
}
