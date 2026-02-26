import { Server } from "socket.io";

export function initBadgeGateway(httpServer: any) {
  const io = new Server(httpServer, { path: "/ws" });

  function emitBadgeEarned(userId: string, badgeId: string) {
    io.to(userId).emit("badge.earned", { userId, badgeId });
  }

  return { io, emitBadgeEarned };
}
