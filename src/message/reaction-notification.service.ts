import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export interface ReactionNotification {
  id: string;
  type: 'reaction_added' | 'reaction_removed';
  messageId: string;
  messageAuthorId: string;
  reactingUserId: string;
  reactionType: string;
  timestamp: string;
  read: boolean;
}

@Injectable()
export class ReactionNotificationService {
  private readonly logger = new Logger(ReactionNotificationService.name);
  private readonly NOTIFICATION_CHANNEL_PREFIX = 'notifications:user:';
  private readonly NOTIFICATION_QUEUE_PREFIX = 'queue:notifications:';
  private readonly NOTIFICATION_TTL = 604800; // 7 days

  constructor(private readonly redisService: RedisService) {}

  /**
   * Send a reaction notification to a user
   */
  async notifyReaction(
    messageAuthorId: string,
    reactingUserId: string,
    messageId: string,
    reactionType: string,
    action: 'added' | 'removed' = 'added',
  ): Promise<void> {
    if (messageAuthorId === reactingUserId) {
      // Don't notify user about their own reactions
      return;
    }

    const notification: ReactionNotification = {
      id: this.generateNotificationId(),
      type: action === 'added' ? 'reaction_added' : 'reaction_removed',
      messageId,
      messageAuthorId,
      reactingUserId,
      reactionType,
      timestamp: new Date().toISOString(),
      read: false,
    };

    try {
      // Store notification
      const channel = `${this.NOTIFICATION_CHANNEL_PREFIX}${messageAuthorId}`;
      const queueKey = `${this.NOTIFICATION_QUEUE_PREFIX}${messageAuthorId}`;

      // Add to notification queue
      await this.redisService.set(
        `${channel}:${notification.id}`,
        JSON.stringify(notification),
        this.NOTIFICATION_TTL,
      );

      this.logger.debug(
        `Reaction notification sent to ${messageAuthorId}: ${reactionType} on message ${messageId}`,
      );
    } catch (error) {
      this.logger.error('Error sending reaction notification:', error);
      // Don't throw - notifications are not critical
    }
  }

  /**
   * Get unread notifications for a user
   */
  async getUnreadNotifications(
    userId: string,
  ): Promise<ReactionNotification[]> {
    // This is a simplified implementation - for production,
    // you'd want to use a dedicated notification database
    try {
      const channel = `${this.NOTIFICATION_CHANNEL_PREFIX}${userId}`;
      // In a real implementation, you'd iterate through all keys with this pattern
      this.logger.debug(`Fetching notifications for user ${userId}`);
      return [];
    } catch (error) {
      this.logger.error('Error fetching notifications:', error);
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(userId: string, notificationId: string): Promise<void> {
    try {
      const channel = `${this.NOTIFICATION_CHANNEL_PREFIX}${userId}`;
      const key = `${channel}:${notificationId}`;

      const notification = await this.redisService.get(key);
      if (notification) {
        const parsed = JSON.parse(notification);
        parsed.read = true;
        await this.redisService.set(
          key,
          JSON.stringify(parsed),
          this.NOTIFICATION_TTL,
        );
      }
    } catch (error) {
      this.logger.error('Error marking notification as read:', error);
    }
  }

  /**
   * Get reaction summary for a message (for notifications)
   */
  async getReactionSummary(
    messageId: string,
    messageAuthorId: string,
  ): Promise<{
    messageId: string;
    totalReactions: number;
    recentReactors: string[];
  }> {
    // This would typically fetch from the reaction service
    return {
      messageId,
      totalReactions: 0,
      recentReactors: [],
    };
  }

  /**
   * Broadcast reaction event for real-time notifications
   */
  async broadcastReactionEvent(
    messageId: string,
    messageAuthorId: string,
    reactingUserId: string,
    reactionType: string,
    action: 'added' | 'removed',
  ): Promise<void> {
    const event = {
      type: `reaction:${action}`,
      messageId,
      reactingUserId,
      reactionType,
      timestamp: new Date().toISOString(),
    };

    try {
      const channel = `message:${messageId}:events`;
      await this.redisService.set(
        `${channel}:last`,
        JSON.stringify(event),
        300, // Keep for 5 minutes
      );

      // Also notify the message author
      await this.notifyReaction(
        messageAuthorId,
        reactingUserId,
        messageId,
        reactionType,
        action,
      );

      this.logger.debug(
        `Reaction event broadcasted: ${action} on message ${messageId}`,
      );
    } catch (error) {
      this.logger.error('Error broadcasting reaction event:', error);
    }
  }

  /**
   * Clear notifications for a user (e.g., when they view reactions)
   */
  async clearNotifications(userId: string): Promise<void> {
    try {
      const channel = `${this.NOTIFICATION_CHANNEL_PREFIX}${userId}`;
      this.logger.debug(`Clearing notifications for user ${userId}`);
      // In a real implementation with a proper notification database,
      // you'd clear notifications here
    } catch (error) {
      this.logger.error('Error clearing notifications:', error);
    }
  }

  /**
   * Generate unique notification ID
   */
  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
