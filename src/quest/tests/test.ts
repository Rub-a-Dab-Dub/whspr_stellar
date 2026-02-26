import { Router } from "express";
import { registerToken, deregisterToken } from "./notification.service";

const router = Router();

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
