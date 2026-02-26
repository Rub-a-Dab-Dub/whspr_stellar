import admin from "firebase-admin";
import { Notification } from "./notification.entity";
import { DeviceToken } from "./deviceToken.entity";

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

export class PushNotificationService {
  async sendFCM(token: string, notification: Notification) {
    try {
      await admin.messaging().send({
        token,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: {
          type: notification.type,
          id: notification.id,
        },
      });
    } catch (err: any) {
      if (err.code === "messaging/invalid-argument" || err.code === "messaging/invalid-registration-token") {
        // Deregister invalid token
        await deregisterToken(token);
      }
      throw err;
    }
  }
}
