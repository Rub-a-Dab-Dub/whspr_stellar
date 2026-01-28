import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { Notification } from '../entities/notification.entity';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  actionUrl?: string;
}

export interface DeviceToken {
  userId: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  isActive: boolean;
}

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private firebaseApp: admin.app.App | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initializeFirebase();
  }

  /**
   * Initialize Firebase Admin SDK
   */
  private initializeFirebase(): void {
    try {
      const firebaseConfig = this.configService.get('firebase');
      
      if (!firebaseConfig?.serviceAccountKey) {
        this.logger.warn('Firebase configuration not found. Push notifications will be disabled.');
        return;
      }

      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(firebaseConfig.serviceAccountKey),
        projectId: firebaseConfig.projectId,
      });

      this.logger.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK:', error);
    }
  }

  /**
   * Send push notification to a single device
   */
  async sendToDevice(token: string, payload: PushNotificationPayload): Promise<boolean> {
    if (!this.firebaseApp) {
      this.logger.warn('Firebase not initialized. Cannot send push notification.');
      return false;
    }

    try {
      const message: admin.messaging.Message = {
        token,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: {
          ...payload.data,
          actionUrl: payload.actionUrl || '',
        },
        android: {
          notification: {
            channelId: 'default',
            priority: 'high' as const,
            defaultSound: true,
            defaultVibrateTimings: true,
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: payload.title,
                body: payload.body,
              },
              badge: 1,
              sound: 'default',
            },
          },
        },
        webpush: {
          notification: {
            title: payload.title,
            body: payload.body,
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            image: payload.imageUrl,
            requireInteraction: true,
            actions: payload.actionUrl ? [
              {
                action: 'open',
                title: 'Open',
              },
            ] : undefined,
          },
          fcmOptions: {
            link: payload.actionUrl,
          },
        },
      };

      const response = await admin.messaging().send(message);
      this.logger.log(`Push notification sent successfully: ${response}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send push notification: ${error.message}`);
      
      // Handle invalid token errors
      if (error.code === 'messaging/invalid-registration-token' || 
          error.code === 'messaging/registration-token-not-registered') {
        this.logger.warn(`Invalid device token: ${token}`);
        // TODO: Mark token as inactive in database
      }
      
      return false;
    }
  }

  /**
   * Send push notification to multiple devices
   */
  async sendToMultipleDevices(tokens: string[], payload: PushNotificationPayload): Promise<{
    successCount: number;
    failureCount: number;
    invalidTokens: string[];
  }> {
    if (!this.firebaseApp || tokens.length === 0) {
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: {
          ...payload.data,
          actionUrl: payload.actionUrl || '',
        },
        android: {
          notification: {
            channelId: 'default',
            priority: 'high' as const,
            defaultSound: true,
            defaultVibrateTimings: true,
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: payload.title,
                body: payload.body,
              },
              badge: 1,
              sound: 'default',
            },
          },
        },
        webpush: {
          notification: {
            title: payload.title,
            body: payload.body,
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            image: payload.imageUrl,
          },
          fcmOptions: {
            link: payload.actionUrl,
          },
        },
      };

      const response = await admin.messaging().sendMulticast(message);
      
      const invalidTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success && 
            (resp.error?.code === 'messaging/invalid-registration-token' ||
             resp.error?.code === 'messaging/registration-token-not-registered')) {
          invalidTokens.push(tokens[idx]);
        }
      });

      this.logger.log(`Push notifications sent: ${response.successCount} success, ${response.failureCount} failed`);
      
      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        invalidTokens,
      };
    } catch (error) {
      this.logger.error(`Failed to send multicast push notification: ${error.message}`);
      return { successCount: 0, failureCount: tokens.length, invalidTokens: [] };
    }
  }

  /**
   * Send notification-based push message
   */
  async sendNotificationPush(notification: Notification, deviceTokens: string[]): Promise<boolean> {
    if (deviceTokens.length === 0) {
      return false;
    }

    const payload: PushNotificationPayload = {
      title: notification.title,
      body: notification.message,
      data: {
        notificationId: notification.id,
        type: notification.type,
        ...(notification.data || {}),
      },
      actionUrl: notification.actionUrl || undefined,
    };

    if (deviceTokens.length === 1) {
      return this.sendToDevice(deviceTokens[0], payload);
    } else {
      const result = await this.sendToMultipleDevices(deviceTokens, payload);
      return result.successCount > 0;
    }
  }

  /**
   * Subscribe device token to topic
   */
  async subscribeToTopic(tokens: string[], topic: string): Promise<void> {
    if (!this.firebaseApp || tokens.length === 0) {
      return;
    }

    try {
      await admin.messaging().subscribeToTopic(tokens, topic);
      this.logger.log(`Subscribed ${tokens.length} tokens to topic: ${topic}`);
    } catch (error) {
      this.logger.error(`Failed to subscribe to topic ${topic}: ${error.message}`);
    }
  }

  /**
   * Unsubscribe device token from topic
   */
  async unsubscribeFromTopic(tokens: string[], topic: string): Promise<void> {
    if (!this.firebaseApp || tokens.length === 0) {
      return;
    }

    try {
      await admin.messaging().unsubscribeFromTopic(tokens, topic);
      this.logger.log(`Unsubscribed ${tokens.length} tokens from topic: ${topic}`);
    } catch (error) {
      this.logger.error(`Failed to unsubscribe from topic ${topic}: ${error.message}`);
    }
  }

  /**
   * Send notification to topic
   */
  async sendToTopic(topic: string, payload: PushNotificationPayload): Promise<boolean> {
    if (!this.firebaseApp) {
      return false;
    }

    try {
      const message: admin.messaging.Message = {
        topic,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: payload.data || {},
      };

      const response = await admin.messaging().send(message);
      this.logger.log(`Topic notification sent successfully: ${response}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send topic notification: ${error.message}`);
      return false;
    }
  }

  /**
   * Validate device token
   */
  async validateToken(token: string): Promise<boolean> {
    if (!this.firebaseApp) {
      return false;
    }

    try {
      // Send a test message to validate the token
      const message: admin.messaging.Message = {
        token,
        data: { test: 'true' },
        dryRun: true, // Don't actually send the message
      };

      await admin.messaging().send(message);
      return true;
    } catch (error) {
      if (error.code === 'messaging/invalid-registration-token' || 
          error.code === 'messaging/registration-token-not-registered') {
        return false;
      }
      // Other errors might be temporary, so consider token valid
      return true;
    }
  }

  /**
   * Get Firebase messaging instance
   */
  getMessaging(): admin.messaging.Messaging | null {
    return this.firebaseApp ? admin.messaging() : null;
  }
}