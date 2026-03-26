import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { Platform } from '../entities/push-subscription.entity';
import { NotificationPayload } from '../interfaces/push-notification.interface';

export enum NotificationType {
  ALERT = 'ALERT',
  MESSAGE = 'MESSAGE',
  ORDER_UPDATE = 'ORDER_UPDATE',
  PROMOTION = 'PROMOTION',
  SYSTEM = 'SYSTEM',
}

@Injectable()
export class NotificationPayloadBuilder {
  buildFcmMessage(
    token: string,
    payload: NotificationPayload,
    platform: Platform,
    notificationType?: string,
  ): admin.messaging.Message {
    const base: admin.messaging.Message = {
      token,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: {
        ...payload.data,
        notificationType: notificationType ?? NotificationType.ALERT,
        clickAction: payload.clickAction ?? 'FLUTTER_NOTIFICATION_CLICK',
      },
    };

    if (platform === Platform.APNS) {
      return {
        ...base,
        apns: {
          payload: {
            aps: {
              alert: { title: payload.title, body: payload.body },
              badge: payload.badge ?? 1,
              sound: payload.sound ?? 'default',
              contentAvailable: true,
            },
          },
          headers: { 'apns-priority': '10' },
        },
      };
    }

    if (platform === Platform.FCM) {
      return {
        ...base,
        android: {
          priority: 'high',
          notification: {
            title: payload.title,
            body: payload.body,
            imageUrl: payload.imageUrl,
            sound: payload.sound ?? 'default',
            clickAction: payload.clickAction,
            channelId: this.resolveAndroidChannel(notificationType),
          },
        },
      };
    }

    // WEB platform
    return {
      ...base,
      webpush: {
        notification: {
          title: payload.title,
          body: payload.body,
          icon: payload.imageUrl ?? '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          requireInteraction: true,
        },
        fcmOptions: { link: payload.clickAction },
      },
    };
  }

  buildTopicMessage(
    topic: string,
    payload: NotificationPayload,
  ): admin.messaging.Message {
    return {
      topic,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: payload.data,
      android: { priority: 'high' },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    };
  }

  buildMulticastMessage(
    tokens: string[],
    payload: NotificationPayload,
    notificationType?: string,
  ): admin.messaging.MulticastMessage {
    return {
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: {
        ...payload.data,
        notificationType: notificationType ?? NotificationType.ALERT,
      },
      android: { priority: 'high' },
      apns: {
        payload: { aps: { sound: 'default', badge: 1, contentAvailable: true } },
      },
      webpush: {
        notification: {
          icon: '/icons/icon-192x192.png',
          requireInteraction: true,
        },
      },
    };
  }

  private resolveAndroidChannel(notificationType?: string): string {
    const channels: Record<string, string> = {
      [NotificationType.ALERT]: 'alerts',
      [NotificationType.MESSAGE]: 'messages',
      [NotificationType.ORDER_UPDATE]: 'orders',
      [NotificationType.PROMOTION]: 'promotions',
      [NotificationType.SYSTEM]: 'system',
    };
    return channels[notificationType ?? ''] ?? 'default';
  }
}
