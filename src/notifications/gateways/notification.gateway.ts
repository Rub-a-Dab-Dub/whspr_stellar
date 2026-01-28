import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Notification } from '../entities/notification.entity';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  private userSockets = new Map<string, Set<string>>();

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket): void {
    try {
      const token = client.handshake.auth.token as string;
      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      const decoded = this.jwtService.verify(token) as Record<string, string>;
      const userId = decoded.sub || decoded.id;

      if (!userId) {
        this.logger.warn(`Client ${client.id} connected with invalid token`);
        client.disconnect();
        return;
      }

      // Store user socket mapping
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)?.add(client.id);

      // Store userId in socket data for easy access
      client.data.userId = userId;

      // Join user to their personal notification room
      void client.join(`user:${userId}`);

      this.logger.log(`User ${userId} connected to notifications with socket ${client.id}`);

      // Send connection confirmation
      client.emit('connected', {
        message: 'Connected to notifications',
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`Connection error for socket ${client.id}:`, error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = client.data.userId;
    
    if (userId) {
      const userSocketSet = this.userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(client.id);
        if (userSocketSet.size === 0) {
          this.userSockets.delete(userId);
        }
      }
      this.logger.log(`User ${userId} disconnected from notifications (socket ${client.id})`);
    } else {
      this.logger.log(`Unknown client ${client.id} disconnected from notifications`);
    }
  }

  @SubscribeMessage('subscribe-to-notifications')
  handleSubscribeToNotifications(@ConnectedSocket() client: Socket): void {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    // User is already subscribed by joining their room on connection
    client.emit('subscribed', {
      message: 'Subscribed to notifications',
      userId,
      timestamp: new Date(),
    });

    this.logger.log(`User ${userId} subscribed to notifications`);
  }

  @SubscribeMessage('unsubscribe-from-notifications')
  handleUnsubscribeFromNotifications(@ConnectedSocket() client: Socket): void {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    void client.leave(`user:${userId}`);
    
    client.emit('unsubscribed', {
      message: 'Unsubscribed from notifications',
      userId,
      timestamp: new Date(),
    });

    this.logger.log(`User ${userId} unsubscribed from notifications`);
  }

  @SubscribeMessage('mark-notification-read')
  handleMarkNotificationRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { notificationId: string },
  ): void {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    // Broadcast to all user's connected devices that notification was read
    this.server.to(`user:${userId}`).emit('notification-read', {
      notificationId: data.notificationId,
      userId,
      timestamp: new Date(),
    });

    this.logger.log(`User ${userId} marked notification ${data.notificationId} as read`);
  }

  @SubscribeMessage('get-online-status')
  handleGetOnlineStatus(@ConnectedSocket() client: Socket): void {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    const connectedSockets = this.userSockets.get(userId)?.size || 0;
    
    client.emit('online-status', {
      userId,
      isOnline: connectedSockets > 0,
      connectedDevices: connectedSockets,
      timestamp: new Date(),
    });
  }

  /**
   * Send notification to a specific user
   */
  async sendNotificationToUser(userId: string, notification: Notification): Promise<void> {
    const userSocketSet = this.userSockets.get(userId);
    
    if (!userSocketSet || userSocketSet.size === 0) {
      this.logger.debug(`User ${userId} is not connected. Notification will be queued.`);
      return;
    }

    const notificationData = {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      senderId: notification.senderId,
      roomId: notification.roomId,
      messageId: notification.messageId,
      actionUrl: notification.actionUrl,
      category: notification.category,
      priority: notification.priority,
      createdAt: notification.createdAt,
      isRead: notification.isRead,
    };

    // Send to user's personal room (all their connected devices)
    this.server.to(`user:${userId}`).emit('new-notification', notificationData);

    this.logger.log(`Real-time notification sent to user ${userId} (${userSocketSet.size} devices)`);
  }

  /**
   * Send notification to multiple users
   */
  async sendNotificationToUsers(userIds: string[], notification: Notification): Promise<void> {
    const promises = userIds.map(userId => this.sendNotificationToUser(userId, notification));
    await Promise.all(promises);
  }

  /**
   * Broadcast notification to all connected users
   */
  async broadcastNotification(notification: Notification): Promise<void> {
    const notificationData = {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      actionUrl: notification.actionUrl,
      category: notification.category,
      priority: notification.priority,
      createdAt: notification.createdAt,
    };

    this.server.emit('broadcast-notification', notificationData);
    this.logger.log(`Broadcast notification sent to all connected users`);
  }

  /**
   * Send typing indicator for notifications (e.g., "Someone is composing a message")
   */
  async sendTypingIndicator(roomId: string, userId: string, isTyping: boolean): Promise<void> {
    this.server.to(`room:${roomId}`).emit('typing-indicator', {
      userId,
      roomId,
      isTyping,
      timestamp: new Date(),
    });
  }

  /**
   * Send unread count update to user
   */
  async sendUnreadCountUpdate(userId: string, unreadCount: number, roomId?: string): Promise<void> {
    this.server.to(`user:${userId}`).emit('unread-count-update', {
      unreadCount,
      roomId,
      timestamp: new Date(),
    });

    this.logger.log(`Unread count update sent to user ${userId}: ${unreadCount}`);
  }

  /**
   * Send notification status update (e.g., delivered, read)
   */
  async sendNotificationStatusUpdate(
    userId: string,
    notificationId: string,
    status: string,
  ): Promise<void> {
    this.server.to(`user:${userId}`).emit('notification-status-update', {
      notificationId,
      status,
      timestamp: new Date(),
    });
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount(): number {
    return this.userSockets.size;
  }

  /**
   * Get connected sockets count
   */
  getConnectedSocketsCount(): number {
    let totalSockets = 0;
    this.userSockets.forEach(sockets => {
      totalSockets += sockets.size;
    });
    return totalSockets;
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId: string): boolean {
    const userSockets = this.userSockets.get(userId);
    return userSockets ? userSockets.size > 0 : false;
  }

  /**
   * Get online users list
   */
  getOnlineUsers(): string[] {
    return Array.from(this.userSockets.keys());
  }

  /**
   * Disconnect user from all devices
   */
  async disconnectUser(userId: string, reason?: string): Promise<void> {
    const userSockets = this.userSockets.get(userId);
    if (!userSockets) return;

    const sockets = Array.from(userSockets);
    for (const socketId of sockets) {
      const socket = this.server.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('force-disconnect', { reason: reason || 'Disconnected by server' });
        socket.disconnect(true);
      }
    }

    this.userSockets.delete(userId);
    this.logger.log(`Force disconnected user ${userId} from ${sockets.length} devices`);
  }
}