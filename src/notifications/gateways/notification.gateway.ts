import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Notification } from '../entities/notification.entity';
import { NotificationService } from '../services/notification.service';
import { WsJwtGuard } from '../../auth/guards/ws-jwt.guard';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private logger = new Logger('NotificationGateway');
  private userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly notificationService: NotificationService,
  ) {}

  handleConnection(client: Socket): void {
    try {
      const token = client.handshake.auth.token as string;
      if (!token) {
        this.logger.warn('Client connected without token');
        client.disconnect();
        return;
      }

      const decoded = this.jwtService.verify(token) as Record<string, string>;
      const userId = decoded.sub || decoded.id;

      if (!userId) {
        this.logger.warn('Invalid token payload');
        client.disconnect();
        return;
      }

      // Store user socket mapping
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)?.add(client.id);

      // Join user to their personal notification room
      client.join(`user:${userId}`);

      // Store userId in socket data for easy access
      client.data.userId = userId;

      this.logger.log(`User ${userId} connected to notifications with socket ${client.id}`);

      // Send initial unread count
      this.sendUnreadCount(userId);
    } catch (error) {
      this.logger.error('Connection error:', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = client.data.userId;
    
    if (userId) {
      const userSockets = this.userSockets.get(userId);
      if (userSockets) {
        userSockets.delete(client.id);
        if (userSockets.size === 0) {
          this.userSockets.delete(userId);
        }
      }
    }

    this.logger.log(`Client ${client.id} disconnected from notifications`);
  }

  @SubscribeMessage('subscribe-notifications')
  @UseGuards(WsJwtGuard)
  async handleSubscribeNotifications(
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const userId = client.data.userId;
    
    if (!userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    // Join user notification room (redundant but ensures subscription)
    client.join(`user:${userId}`);
    
    // Send current unread count
    await this.sendUnreadCount(userId);
    
    client.emit('subscribed', { message: 'Subscribed to notifications' });
    this.logger.log(`User ${userId} subscribed to notifications`);
  }

  @SubscribeMessage('mark-notification-read')
  @UseGuards(WsJwtGuard)
  async handleMarkNotificationRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { notificationId: string },
  ): Promise<void> {
    const userId = client.data.userId;
    
    if (!userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    try {
      await this.notificationService.markAsRead(data.notificationId, userId);
      
      // Send updated unread count
      await this.sendUnreadCount(userId);
      
      client.emit('notification-marked-read', { 
        notificationId: data.notificationId,
        success: true,
      });
    } catch (error) {
      this.logger.error('Error marking notification as read:', error);
      client.emit('error', { message: 'Failed to mark notification as read' });
    }
  }

  @SubscribeMessage('mark-all-read')
  @UseGuards(WsJwtGuard)
  async handleMarkAllRead(
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const userId = client.data.userId;
    
    if (!userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    try {
      const markedCount = await this.notificationService.markAllAsRead(userId);
      
      client.emit('all-notifications-marked-read', { 
        markedCount,
        success: true,
      });
      
      // Broadcast to all user's sockets
      this.server.to(`user:${userId}`).emit('unread-count-updated', { 
        unreadCount: 0,
      });
    } catch (error) {
      this.logger.error('Error marking all notifications as read:', error);
      client.emit('error', { message: 'Failed to mark all notifications as read' });
    }
  }

  @SubscribeMessage('get-notifications')
  @UseGuards(WsJwtGuard)
  async handleGetNotifications(
    @ConnectedSocket() client: Socket,
    @MessageBody() query: { page?: string; limit?: string; unreadOnly?: boolean },
  ): Promise<void> {
    const userId = client.data.userId;
    
    if (!userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    try {
      const result = await this.notificationService.getNotifications(userId, query);
      
      client.emit('notifications-data', {
        notifications: result.notifications,
        total: result.total,
        unreadCount: result.unreadCount,
        page: parseInt(query.page || '1'),
        limit: parseInt(query.limit || '20'),
      });
    } catch (error) {
      this.logger.error('Error getting notifications:', error);
      client.emit('error', { message: 'Failed to get notifications' });
    }
  }

  /**
   * Send notification to specific user
   */
  async sendNotificationToUser(
    userId: string,
    notification: Notification,
  ): Promise<void> {
    const userRoom = `user:${userId}`;
    
    this.server.to(userRoom).emit('new-notification', {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      priority: notification.priority,
      actionUrl: notification.actionUrl,
      imageUrl: notification.imageUrl,
      createdAt: notification.createdAt,
      sender: notification.sender ? {
        id: notification.sender.id,
        email: notification.sender.email,
      } : null,
    });

    // Update unread count
    await this.sendUnreadCount(userId);
    
    this.logger.debug(`Real-time notification sent to user ${userId}`);
  }

  /**
   * Emit notification read event
   */
  emitNotificationRead(userId: string, notificationId: string): void {
    this.server.to(`user:${userId}`).emit('notification-read', {
      notificationId,
      readAt: new Date(),
    });
  }

  /**
   * Emit all notifications read event
   */
  emitAllNotificationsRead(userId: string): void {
    this.server.to(`user:${userId}`).emit('all-notifications-read', {
      readAt: new Date(),
    });
  }

  /**
   * Send unread count to user
   */
  private async sendUnreadCount(userId: string): Promise<void> {
    try {
      const result = await this.notificationService.getNotifications(userId, { unreadOnly: true });
      
      this.server.to(`user:${userId}`).emit('unread-count-updated', {
        unreadCount: result.unreadCount,
      });
    } catch (error) {
      this.logger.error('Error sending unread count:', error);
    }
  }

  /**
   * Broadcast notification to multiple users
   */
  async broadcastNotificationToUsers(
    userIds: string[],
    notification: Notification,
  ): Promise<void> {
    for (const userId of userIds) {
      await this.sendNotificationToUser(userId, notification);
    }
  }

  /**
   * Get connected users count
   */
  getConnectedUsersCount(): number {
    return this.userSockets.size;
  }

  /**
   * Check if user is connected
   */
  isUserConnected(userId: string): boolean {
    return this.userSockets.has(userId);
  }
}