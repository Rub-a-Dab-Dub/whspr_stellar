import { Router } from "express";
import { NotificationService } from "./notification.service";
import { registerToken, deregisterToken } from "./notification.service";

const router = Router();
const service = new NotificationService();

// GET /notifications
router.get("/notifications", async (req, res) => {
  const { userId, page, limit } = req.query;
  const data = await service.getNotifications(userId as string, Number(page), Number(limit));
  res.json(data);
});

// PATCH /notifications/:id/read
router.patch("/notifications/:id/read", async (req, res) => {
  const notif = await service.markAsRead(req.params.id);
  res.json(notif);
});

// PATCH /notifications/read-all
router.patch("/notifications/read-all", async (req, res) => {
  await service.markAllAsRead(req.query.userId as string);
  res.json({ success: true });
});

// GET /notifications/unread-count
router.get("/notifications/unread-count", async (req, res) => {
  const count = await service.getUnreadCount(req.query.userId as string);
  res.json({ count });
});


// POST /notifications/device-tokens
router.post("/notifications/device-tokens", async (req, res) => {
  const { userId, token, platform } = req.body;
  await registerToken({ userId, token, platform, isActive: true, lastUsedAt: new Date() });
  res.json({ success: true });
});

// DELETE /notifications/device-tokens/:token
router.delete("/notifications/device-tokens/:token", async (req, res) => {
  await deregisterToken(req.params.token);
  res.json({ success: true });
});


export default router;

