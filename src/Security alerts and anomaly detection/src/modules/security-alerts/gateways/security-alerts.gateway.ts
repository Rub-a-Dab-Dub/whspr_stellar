import { Injectable, Logger } from "@nestjs/common";
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import {
  SecurityAlert,
  AlertSeverity,
} from "../entities/security-alert.entity";

@Injectable()
@WebSocketGateway({
  namespace: "security",
  cors: {
    origin: process.env.WS_CORS_ORIGIN || "*",
    credentials: true,
  },
  transports: ["websocket"],
})
export class SecurityAlertsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SecurityAlertsGateway.name);
  private connectedAdmins = new Map<string, Socket>();

  onGatewayConnection(client: Socket) {
    // In a real implementation, you would validate JWT here
    const userId = client.handshake.query.userId as string;
    const userRole = client.handshake.query.role as string;

    if (!userId || !userRole) {
      client.disconnect();
      return;
    }

    if (!["ADMIN", "SUPER_ADMIN"].includes(userRole)) {
      client.disconnect();
      return;
    }

    this.connectedAdmins.set(client.id, client);
    this.logger.log(
      `Admin ${userId} connected. Total connected: ${this.connectedAdmins.size}`,
    );
  }

  onGatewayDisconnect(client: Socket) {
    const userId = client.handshake.query.userId as string;
    this.connectedAdmins.delete(client.id);
    this.logger.log(
      `Admin ${userId} disconnected. Total connected: ${this.connectedAdmins.size}`,
    );
  }

  /**
   * Emit a security alert to all connected admins
   * Only for high/critical severity alerts
   */
  emitSecurityAlert(alert: SecurityAlert) {
    const severityLevels: AlertSeverity[] = ["high", "critical"];

    if (!severityLevels.includes(alert.severity)) {
      return; // Don't emit low/medium severity alerts
    }

    this.logger.log(`Emitting security alert: ${alert.id} (${alert.severity})`);

    const alertData = {
      id: alert.id,
      rule: alert.rule,
      severity: alert.severity,
      status: alert.status,
      details: alert.details,
      userId: alert.userId,
      createdAt: alert.createdAt,
    };

    // Emit to all connected admin clients
    this.server.emit("security.alert", alertData);
  }

  /**
   * Get connection stats for monitoring
   */
  getConnectionStats() {
    return {
      connectedAdmins: this.connectedAdmins.size,
      timestamp: new Date(),
    };
  }
}
