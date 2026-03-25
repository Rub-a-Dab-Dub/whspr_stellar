import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SecurityNotificationsService {
  private readonly logger = new Logger(SecurityNotificationsService.name);

  async sendNewDeviceLoginAlert(
    userId: string,
    deviceInfo: string,
    ipAddress: string | null,
  ): Promise<void> {
    this.logger.warn(
      `Security alert queued for user=${userId} device="${deviceInfo}" ip=${ipAddress ?? 'unknown'}`,
    );
  }
}
