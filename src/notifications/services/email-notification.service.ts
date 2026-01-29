import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Notification } from '../entities/notification.entity';
import { NotificationType } from '../enums/notification-type.enum';

export interface EmailNotificationData {
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  template: string;
  context: Record<string, any>;
}

@Injectable()
export class EmailNotificationService {
  private readonly logger = new Logger(EmailNotificationService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Send email notification
   */
  async sendEmailNotification(
    notification: Notification,
    recipientEmail: string,
  ): Promise<boolean> {
    try {
      const emailData = this.prepareEmailData(notification, recipientEmail);
      
      await this.mailerService.sendMail({
        to: emailData.recipientEmail,
        subject: emailData.subject,
        template: emailData.template,
        context: emailData.context,
      });

      this.logger.log(`Email notification sent to ${recipientEmail} for notification ${notification.id}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email notification to ${recipientEmail}:`, error);
      return false;
    }
  }

  /**
   * Send batch email notifications
   */
  async sendBatchEmailNotifications(
    notifications: { notification: Notification; recipientEmail: string }[],
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const { notification, recipientEmail } of notifications) {
      const success = await this.sendEmailNotification(notification, recipientEmail);
      if (success) {
        sent++;
      } else {
        failed++;
      }
    }

    this.logger.log(`Batch email notifications: ${sent} sent, ${failed} failed`);
    return { sent, failed };
  }

  /**
   * Send digest email with multiple notifications
   */
  async sendDigestEmail(
    recipientEmail: string,
    notifications: Notification[],
    period: 'daily' | 'weekly' = 'daily',
  ): Promise<boolean> {
    try {
      const user = await this.userRepository.findOne({
        where: { email: recipientEmail },
      });

      const groupedNotifications = this.groupNotificationsByType(notifications);
      
      await this.mailerService.sendMail({
        to: recipientEmail,
        subject: `Your ${period} notification digest - Whspr Stellar`,
        template: 'notification-digest',
        context: {
          userName: user?.email?.split('@')[0] || 'User',
          period,
          totalCount: notifications.length,
          groupedNotifications,
          unsubscribeUrl: this.getUnsubscribeUrl(user?.id),
          appUrl: this.configService.get<string>('APP_URL', 'https://whspr.com'),
        },
      });

      this.logger.log(`Digest email sent to ${recipientEmail} with ${notifications.length} notifications`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send digest email to ${recipientEmail}:`, error);
      return false;
    }
  }

  /**
   * Send welcome email with notification preferences
   */
  async sendWelcomeEmail(recipientEmail: string): Promise<boolean> {
    try {
      await this.mailerService.sendMail({
        to: recipientEmail,
        subject: 'Welcome to Whspr Stellar - Set up your notifications',
        template: 'welcome-notifications',
        context: {
          userName: recipientEmail.split('@')[0],
          settingsUrl: `${this.configService.get<string>('APP_URL')}/settings/notifications`,
          appUrl: this.configService.get<string>('APP_URL', 'https://whspr.com'),
        },
      });

      this.logger.log(`Welcome email sent to ${recipientEmail}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${recipientEmail}:`, error);
      return false;
    }
  }

  /**
   * Prepare email data based on notification type
   */
  private prepareEmailData(
    notification: Notification,
    recipientEmail: string,
  ): EmailNotificationData {
    const baseContext = {
      userName: recipientEmail.split('@')[0],
      notificationTitle: notification.title,
      notificationMessage: notification.message,
      actionUrl: notification.actionUrl,
      appUrl: this.configService.get<string>('APP_URL', 'https://whspr.com'),
      unsubscribeUrl: this.getUnsubscribeUrl(notification.recipientId),
    };

    switch (notification.type) {
      case NotificationType.MENTION:
        return {
          recipientEmail,
          subject: `You were mentioned in Whspr Stellar`,
          template: 'mention-notification',
          context: {
            ...baseContext,
            mentionedBy: notification.sender?.email?.split('@')[0] || 'Someone',
            messageContent: notification.message,
            roomName: notification.data?.roomName || 'a room',
          },
        };

      case NotificationType.REPLY:
        return {
          recipientEmail,
          subject: `New reply to your message`,
          template: 'reply-notification',
          context: {
            ...baseContext,
            repliedBy: notification.sender?.email?.split('@')[0] || 'Someone',
            originalMessage: notification.data?.originalMessage || '',
            replyContent: notification.message,
          },
        };

      case NotificationType.ROOM_INVITE:
        return {
          recipientEmail,
          subject: `You've been invited to join a room`,
          template: 'room-invite-notification',
          context: {
            ...baseContext,
            invitedBy: notification.sender?.email?.split('@')[0] || 'Someone',
            roomName: notification.data?.roomName || 'a room',
            roomDescription: notification.data?.roomDescription || '',
          },
        };

      case NotificationType.REACTION:
        return {
          recipientEmail,
          subject: `Someone reacted to your message`,
          template: 'reaction-notification',
          context: {
            ...baseContext,
            reactedBy: notification.sender?.email?.split('@')[0] || 'Someone',
            reactionType: notification.data?.reactionType || '👍',
            messageContent: notification.data?.messageContent || notification.message,
          },
        };

      case NotificationType.REWARD_GRANTED:
        return {
          recipientEmail,
          subject: `You've received a new reward!`,
          template: 'reward-notification',
          context: {
            ...baseContext,
            rewardName: notification.data?.rewardName || 'a reward',
            rewardDescription: notification.data?.rewardDescription || '',
            rewardValue: notification.data?.rewardValue || '',
          },
        };

      default:
        return {
          recipientEmail,
          subject: notification.title,
          template: 'generic-notification',
          context: baseContext,
        };
    }
  }

  /**
   * Group notifications by type for digest emails
   */
  private groupNotificationsByType(notifications: Notification[]): Record<string, Notification[]> {
    return notifications.reduce((groups, notification) => {
      const type = notification.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(notification);
      return groups;
    }, {} as Record<string, Notification[]>);
  }

  /**
   * Get unsubscribe URL for user
   */
  private getUnsubscribeUrl(userId?: string): string {
    const baseUrl = this.configService.get<string>('APP_URL', 'https://whspr.com');
    return userId 
      ? `${baseUrl}/unsubscribe?token=${this.generateUnsubscribeToken(userId)}`
      : `${baseUrl}/settings/notifications`;
  }

  /**
   * Generate unsubscribe token (simplified - should use proper JWT or similar)
   */
  private generateUnsubscribeToken(userId: string): string {
    // In production, this should be a proper JWT token with expiration
    return Buffer.from(`${userId}:${Date.now()}`).toString('base64');
  }
}