import { Router } from "express";
import { LeaderboardService } from "./leaderboard.service";

const router = Router();
const service = new LeaderboardService();

// GET /leaderboard?category=xp&period=all&roomId=123
router.get("/leaderboard", async (req, res) => {
  const { category, period, roomId, userId } = req.query;
  const top = await service.getTop(category as any, period as any, roomId as string);
  const userRank = userId ? await service.getUserRank(category as any, period as any, userId as string, roomId as string) : null;
  res.json({ top, userRank });
});

export default router;
