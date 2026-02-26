import { Router } from "express";
import { BadgeService } from "./badge.service";

const router = Router();
const service = new BadgeService();

// GET /badges
router.get("/badges", async (req, res) => {
  res.json(await service.getAllBadges());
});

// GET /users/:id/badges
router.get("/users/:id/badges", async (req, res) => {
  res.json(await service.getUserBadges(req.params.id));
});

// POST /badges/:id/mint
router.post("/badges/:id/mint", async (req, res) => {
  const userBadgeId = req.body.userBadgeId;
  const minted = await service.mintBadge(userBadgeId);
  res.json(minted);
});

export default router;
