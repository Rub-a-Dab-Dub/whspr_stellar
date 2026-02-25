import { Queue, Worker } from "bullmq";
import { NotificationService } from "./notification.service";

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
