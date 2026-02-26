import { Router } from "express";
import { QuestService } from "./quest.service";

const router = Router();
const service = new QuestService();

// GET /quests
router.get("/quests", async (req, res) => {
  const userId = req.query.userId as string;
  res.json(await service.getAllQuests(userId));
});

// GET /quests/active
router.get("/quests/active", async (req, res) => {
  const userId = req.query.userId as string;
  res.json(await service.getActiveQuests(userId));
});

export default router;
