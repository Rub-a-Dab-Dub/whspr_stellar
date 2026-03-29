import { Injectable, Logger } from '@nestjs/common';

export interface ConnectionRequestPushPayload {
  requestId: string;
  senderId: string;
  introPreview: string;
}

/**
 * Delivers native push for connection requests. Wire to FCM/APNs when the push module is mounted in AppModule.
 * In-app delivery is handled separately via {@link NotificationsService}.
 */
@Injectable()
export class ConnectionPushNotifier {
  private readonly logger = new Logger(ConnectionPushNotifier.name);

  /** Target SLA: receiver should get push within ~5s of send (enqueue + provider latency). */
  async notifyConnectionRequest(receiverUserId: string, payload: ConnectionRequestPushPayload): Promise<void> {
    const started = Date.now();
    await Promise.resolve();
    this.logger.verbose(
      `push(connection_request): to=${receiverUserId} request=${payload.requestId} sender=${payload.senderId} (${Date.now() - started}ms)`,
    );
  }
}
