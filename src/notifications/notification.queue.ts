import { Queue, Worker } from "bullmq";
import { NotificationService } from "./notification.service";
import { PushNotificationService } from "./notification.push";

const notificationQueue = new Queue("notifications");
const service = new NotificationService();

// Producer: enqueue fanout job
export async function enqueueNotificationFanout(roomId: string, notification: any) {
  await notificationQueue.add("fanout", { roomId, notification });
}

// Worker: process fanout
new Worker("notifications", async (job) => {
  const { roomId, notification } = job.data;
  // Fetch all users in room (pseudo-code)
  const users = await getUsersInRoom(roomId);
  for (const userId of users) {
    await service.createNotification({ ...notification, userId });
    // Optionally emit via WebSocket
  }
});


const pushQueue = new Queue("pushNotifications");
// Producer
export async function enqueuePush(token: string, notification: any) {
  await pushQueue.add("send", { token, notification }, { attempts: 3, backoff: { type: "exponential", delay: 2000 } });
}

// Worker
new Worker("pushNotifications", async (job) => {
  const { token, notification } = job.data;
  await service.sendFCM(token, notification);
});
