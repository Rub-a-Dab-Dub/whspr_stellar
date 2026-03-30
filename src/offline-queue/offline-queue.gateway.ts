import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OfflineQueueService } from './offline-queue.service';

/**
 * Attaches to the shared /chat namespace.
 * On every authenticated connection it flushes any queued offline messages
 * in strict chronological order, bracketed by sync:start / sync:complete events.
 *
 * JWT verification is intentionally skipped here — the ChatGateway in the
 * messaging module already rejects unauthenticated sockets before this handler
 * runs (same namespace, socket.io fires connection handlers in registration order).
 * We read the userId set by ChatGateway from client.data.user.sub.
 */
@WebSocketGateway({ namespace: '/chat', cors: { origin: '*' } })
export class OfflineQueueGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(OfflineQueueGateway.name);

  constructor(private readonly offlineQueueService: OfflineQueueService) {}

  async handleConnection(@ConnectedSocket() client: Socket): Promise<void> {
    // Allow a short tick so ChatGateway (registered first) can authenticate and
    // set client.data.user before we attempt to flush.
    await new Promise((resolve) => setImmediate(resolve));

    const userId: string | undefined = (client.data?.user as { sub?: string } | undefined)?.sub;
    if (!userId) {
      // Socket was not authenticated — ChatGateway will disconnect it.
      return;
    }

    const depth = await this.offlineQueueService.getQueueDepth(userId);
    if (depth === 0) return;

    this.logger.log(
      `[OfflineQueue] user=${userId} reconnected with ${depth} queued message(s) — flushing`,
    );

    await this.offlineQueueService.flushOnConnect(userId, this.server, client.id);
  }
}
