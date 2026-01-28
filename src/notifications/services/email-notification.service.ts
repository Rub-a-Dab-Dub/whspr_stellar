import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { Notification } from '../entities/notification.entity';
import { NotificationType } from '../enums/notification-type.enum';

export interface EmailTemplate {
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
  ) {}

  /**
   * Send email notification
   */
  async sendEmailNotification(
    email: string,
    notification: Notification,
    userDisplayName?: string,
  ): Promise<boolean> {
    try {
      const emailTemplate = this.getEmailTemplate(notification, userDisplayName);
      
      await this.mailerService.sendMail({
        to: email,
        subject: emailTemplate.subject,
        template: emailTemplate.template,
        context: emailTemplate.context,
      });

      this.logger.log(`Email notification sent to ${email} for notification ${notification.id}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email notification: ${error.message}`);
      return false;
    }
  }

  /**
   * Send batch email notifications
   */
  async sendBatchEmailNotifications(
    recipients: Array<{ email: string; notification: Notification; displayName?: string }>,
  ): Promise<{ successCount: number; failureCount: number }> {
    let successCount = 0;
    let failureCount = 0;

    for (const recipient of recipients) {
      const success = await this.sendEmailNotification(
        recipient.email,
        recipient.notification,
        recipient.displayName,
      );
      
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    this.logger.log(`Batch email sent: ${successCount} success, ${failureCount} failed`);
    return { successCount, failureCount };
  }

  /**
   * Get email template based on notification type
   */
  private getEmailTemplate(notification: Notification, userDisplayName?: string): EmailTemplate {
    const baseContext = {
      recipientName: userDisplayName || 'User',
      notificationTitle: notification.title,
      notificationMessage: notification.message,
      actionUrl: notification.actionUrl,
      appName: this.configService.get('app.name', 'Whspr'),
      appUrl: this.configService.get('app.url', 'https://whspr.app'),
      unsubscribeUrl: `${this.configService.get('app.url')}/notifications/unsubscribe`,
    };

    switch (notification.type) {
      case NotificationType.MENTION:
        return {
          subject: `You were mentioned in ${baseContext.appName}`,
          template: 'mention-notification',
          context: {
            ...baseContext,
            mentionedBy: notification.sender?.email || 'Someone',
            messageContent: notification.data?.messageContent || notification.message,
          },
        };

      case NotificationType.REPLY:
        return {
          subject: `Someone replied to your message`,
          template: 'reply-notification',
          context: {
            ...baseContext,
            repliedBy: notification.sender?.email || 'Someone',
            originalMessage: notification.data?.originalMessage || '',
            replyContent: notification.data?.replyContent || notification.message,
          },
        };

      case NotificationType.ROOM_INVITATION:
        return {
          subject: `You've been invited to join a room`,
          template: 'room-invitation',
          context: {
            ...baseContext,
            invitedBy: notification.sender?.email || 'Someone',
            roomName: notification.data?.roomName || 'a room',
            invitationUrl: notification.actionUrl,
          },
        };

      case NotificationType.LEVEL_UP:
        return {
          subject: `Congratulations! You've leveled up!`,
          template: 'level-up',
          context: {
            ...baseContext,
            newLevel: notification.data?.newLevel || 'unknown',
            xpGained: notification.data?.xpGained || 0,
          },
        };

      case NotificationType.ACHIEVEMENT_UNLOCKED:
        return {
          subject: `Achievement Unlocked: ${notification.data?.achievementName || 'New Achievement'}`,
          template: 'achievement-unlocked',
          context: {
            ...baseContext,
            achievementName: notification.data?.achievementName || 'New Achievement',
            achievementDescription: notification.data?.achievementDescription || '',
            achievementIcon: notification.data?.achievementIcon,
          },
        };

      case NotificationType.REWARD_GRANTED:
        return {
          subject: `You've received a new reward!`,
          template: 'reward-granted',
          context: {
            ...baseContext,
            rewardName: notification.data?.rewardName || 'New Reward',
            rewardDescription: notification.data?.rewardDescription || '',
            rewardValue: notification.data?.rewardValue || '',
          },
        };

      case NotificationType.LOGIN_SUCCESS:
        return {
          subject: `Successful login to your ${baseContext.appName} account`,
          template: 'login-success',
          context: {
            ...baseContext,
            loginTime: new Date().toLocaleString(),
            ipAddress: notification.data?.ipAddress || 'Unknown',
            userAgent: notification.data?.userAgent || 'Unknown',
          },
        };

      case NotificationType.LOGIN_FAILED:
        return {
          subject: `Failed login attempt on your ${baseContext.appName} account`,
          template: 'login-failed',
          context: {
            ...baseContext,
            attemptTime: new Date().toLocaleString(),
            ipAddress: notification.data?.ipAddress || 'Unknown',
            userAgent: notification.data?.userAgent || 'Unknown',
          },
        };

      case NotificationType.PASSWORD_CHANGED:
        return {
          subject: `Your ${baseContext.appName} password has been changed`,
          template: 'password-changed',
          context: {
            ...baseContext,
            changeTime: new Date().toLocaleString(),
            ipAddress: notification.data?.ipAddress || 'Unknown',
          },
        };

      case NotificationType.EMAIL_CHANGED:
        return {
          subject: `Your ${baseContext.appName} email has been changed`,
          template: 'email-changed',
          context: {
            ...baseContext,
            oldEmail: notification.data?.oldEmail || 'Previous email',
            newEmail: notification.data?.newEmail || 'New email',
            changeTime: new Date().toLocaleString(),
          },
        };

      case NotificationType.ANNOUNCEMENT:
        return {
          subject: notification.title,
          template: 'announcement',
          context: {
            ...baseContext,
            announcementContent: notification.message,
            announcementDate: notification.createdAt.toLocaleDateString(),
          },
        };

      case NotificationType.MAINTENANCE:
        return {
          subject: `${baseContext.appName} Maintenance Notification`,
          template: 'maintenance',
          context: {
            ...baseContext,
            maintenanceStart: notification.data?.maintenanceStart || 'Soon',
            maintenanceEnd: notification.data?.maintenanceEnd || 'Unknown',
            maintenanceReason: notification.data?.maintenanceReason || 'Scheduled maintenance',
          },
        };

      default:
        return {
          subject: notification.title,
          template: 'generic-notification',
          context: baseContext,
        };
    }
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(email: string, displayName?: string): Promise<boolean> {
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: `Welcome to ${this.configService.get('app.name', 'Whspr')}!`,
        template: 'welcome',
        context: {
          recipientName: displayName || 'User',
          appName: this.configService.get('app.name', 'Whspr'),
          appUrl: this.configService.get('app.url', 'https://whspr.app'),
          supportEmail: this.configService.get('app.supportEmail', 'support@whspr.app'),
        },
      });

      this.logger.log(`Welcome email sent to ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send welcome email: ${error.message}`);
      return false;
    }
  }

  /**
   * Send digest email with multiple notifications
   */
  async sendDigestEmail(
    email: string,
    notifications: Notification[],
    userDisplayName?: string,
    period: 'daily' | 'weekly' = 'daily',
  ): Promise<boolean> {
    try {
      const groupedNotifications = this.groupNotificationsByType(notifications);
      
      await this.mailerService.sendMail({
        to: email,
        subject: `Your ${period} ${this.configService.get('app.name', 'Whspr')} digest`,
        template: 'digest',
        context: {
          recipientName: userDisplayName || 'User',
          period,
          totalNotifications: notifications.length,
          groupedNotifications,
          appName: this.configService.get('app.name', 'Whspr'),
          appUrl: this.configService.get('app.url', 'https://whspr.app'),
          unsubscribeUrl: `${this.configService.get('app.url')}/notifications/unsubscribe`,
        },
      });

      this.logger.log(`Digest email sent to ${email} with ${notifications.length} notifications`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send digest email: ${error.message}`);
      return false;
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
}