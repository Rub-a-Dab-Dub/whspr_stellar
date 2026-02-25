import { Server } from "socket.io";
import { NotificationService } from "./notification.service";

export function initNotificationGateway(httpServer: any) {
  const io = new Server(httpServer, { path: "/ws" });
  const service = new NotificationService();

  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId as string;

    socket.on("disconnect", () => {
      console.log(`User ${userId} disconnected`);
    });

    // Example: push new notification
    service.createNotification({
      id: crypto.randomUUID(),
      userId,
      type: "TIP_RECEIVED",
      title: "You received a tip!",
      body: "Someone tipped you 50 coins.",
      data: {},
      isRead: false,
      createdAt: new Date(),
    }).then((notif) => {
      io.to(socket.id).emit("notification.new", notif);
    });
  });

  return io;
}
