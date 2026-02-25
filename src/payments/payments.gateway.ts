import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

export const PAYMENT_EVENTS = {
  TRANSFER_RECEIVED: 'payment.transfer_received',
  TIP_RECEIVED: 'payment.tip_received',
} as const;

@WebSocketGateway({
  namespace: '/payments',
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
})
export class PaymentsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PaymentsGateway.name);
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(private readonly jwtService: JwtService) { }

  handleConnection(client: { handshake: { auth: { token?: string } }; id: string; join: (room: string) => void; data: { userId?: string }; disconnect: () => void }) {
    try {
      const token = client.handshake.auth?.token;
      if (!token) {
        this.logger.warn('Client connected to payments without token');
        client.disconnect();
        return;
      }
      const decoded = this.jwtService.verify(token);
      const userId = decoded.sub ?? decoded.id;
      if (!userId) {
        this.logger.warn('Invalid token payload for payments');
        client.disconnect();
        return;
      }
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);
      client.join(`user:${userId}`);
      client.data.userId = userId;
      this.logger.log(`User ${userId} connected to payments with socket ${client.id}`);
    } catch {
      this.logger.error('Payments connection error');
      client.disconnect();
    }
  }

  handleDisconnect(client: { id: string; data: { userId?: string } }) {
    const userId = client.data?.userId;
    if (userId) {
      const userSockets = this.userSockets.get(userId);
      if (userSockets) {
        userSockets.delete(client.id);
        if (userSockets.size === 0) {
          this.userSockets.delete(userId);
        }
      }
    }
    this.logger.log(`Payments client ${client.id} disconnected`);
  }

  emitTransferReceived(recipientUserId: string, payload: {
    paymentId: string;
    amount: string;
    tokenAddress: string | null;
    senderId: string;
    transactionHash: string | null;
  }): void {
    this.server.to(`user:${recipientUserId}`).emit(PAYMENT_EVENTS.TRANSFER_RECEIVED, payload);
    this.logger.debug(`Emitted payment.transfer_received to user ${recipientUserId}`);
  }

  emitTipReceived(recipientUserId: string, payload: {
    paymentId: string;
    amount: string;
    tokenAddress: string | null;
    senderId: string;
    roomId: string;
    transactionHash: string;
  }): void {
    this.server.to(`user:${recipientUserId}`).emit(PAYMENT_EVENTS.TIP_RECEIVED, payload);
    this.logger.debug(`Emitted payment.tip_received to user ${recipientUserId}`);
  }
}
