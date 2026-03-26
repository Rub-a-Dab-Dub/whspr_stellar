import { NotificationPayloadBuilder, NotificationType } from '../builders/notification-payload.builder';
import { Platform } from '../entities/push-subscription.entity';
import { NotificationPayload } from '../interfaces/push-notification.interface';

const payload: NotificationPayload = {
  title: 'Order Shipped!',
  body: 'Your package is on the way.',
  imageUrl: 'https://example.com/img.png',
  data: { orderId: '123' },
  sound: 'default',
  badge: 2,
};

describe('NotificationPayloadBuilder', () => {
  let builder: NotificationPayloadBuilder;

  beforeEach(() => {
    builder = new NotificationPayloadBuilder();
  });

  describe('buildFcmMessage (Android/FCM)', () => {
    it('should build high-priority Android message', () => {
      const msg = builder.buildFcmMessage('token-android', payload, Platform.FCM, NotificationType.ORDER_UPDATE);
      expect(msg.token).toBe('token-android');
      expect(msg.notification?.title).toBe('Order Shipped!');
      expect((msg as any).android?.priority).toBe('high');
      expect((msg as any).android?.notification?.channelId).toBe('orders');
    });

    it('should assign correct channel per notification type', () => {
      const types: [string, string][] = [
        [NotificationType.ALERT, 'alerts'],
        [NotificationType.MESSAGE, 'messages'],
        [NotificationType.PROMOTION, 'promotions'],
        [NotificationType.SYSTEM, 'system'],
      ];

      types.forEach(([type, channel]) => {
        const msg = builder.buildFcmMessage('token', payload, Platform.FCM, type);
        expect((msg as any).android?.notification?.channelId).toBe(channel);
      });
    });

    it('should default to "default" channel for unknown type', () => {
      const msg = builder.buildFcmMessage('token', payload, Platform.FCM, 'UNKNOWN');
      expect((msg as any).android?.notification?.channelId).toBe('default');
    });
  });

  describe('buildFcmMessage (APNS)', () => {
    it('should build APNS message with aps payload', () => {
      const msg = builder.buildFcmMessage('apns-token', payload, Platform.APNS);
      expect(msg.token).toBe('apns-token');
      expect((msg as any).apns?.payload?.aps?.sound).toBe('default');
      expect((msg as any).apns?.payload?.aps?.badge).toBe(2);
      expect((msg as any).apns?.headers?.['apns-priority']).toBe('10');
    });
  });

  describe('buildFcmMessage (WEB)', () => {
    it('should build webpush message', () => {
      const msg = builder.buildFcmMessage('web-token', payload, Platform.WEB);
      expect((msg as any).webpush?.notification?.title).toBe('Order Shipped!');
      expect((msg as any).webpush?.notification?.requireInteraction).toBe(true);
    });
  });

  describe('buildTopicMessage', () => {
    it('should build a valid topic message', () => {
      const msg = builder.buildTopicMessage('news', payload);
      expect((msg as any).topic).toBe('news');
      expect(msg.notification?.title).toBe('Order Shipped!');
    });
  });

  describe('buildMulticastMessage', () => {
    it('should build a multicast message with all tokens', () => {
      const tokens = ['t1', 't2', 't3'];
      const msg = builder.buildMulticastMessage(tokens, payload, NotificationType.MESSAGE);
      expect(msg.tokens).toEqual(tokens);
      expect(msg.notification?.title).toBe('Order Shipped!');
      expect(msg.data?.notificationType).toBe(NotificationType.MESSAGE);
    });

    it('should default notificationType to ALERT', () => {
      const msg = builder.buildMulticastMessage(['t1'], payload);
      expect(msg.data?.notificationType).toBe(NotificationType.ALERT);
    });

    it('should include android, apns, and webpush config', () => {
      const msg = builder.buildMulticastMessage(['t1'], payload);
      expect(msg.android?.priority).toBe('high');
      expect((msg.apns as any)?.payload?.aps?.sound).toBe('default');
      expect((msg.webpush as any)?.notification?.requireInteraction).toBe(true);
    });
  });
});
