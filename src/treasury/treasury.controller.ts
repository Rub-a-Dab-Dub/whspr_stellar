import { Router } from "express";
import { TreasuryService } from "./treasury.service";
import { TreasuryAggregator } from "./treasury.aggregator";

const router = Router();
const service = new TreasuryService();

// GET /admin/treasury
router.get("/admin/treasury", async (req, res) => {
  const totals = await service.getTotalFeesByTokenAndChain();
  res.json(totals);
});

// GET /admin/treasury/history
router.get("/admin/treasury/history", async (req, res) => {
  const { page, limit, chain, tokenAddress } = req.query;
  const history = await service.getFeeHistory(
    Number(page) || 1,
    Number(limit) || 20,
    { chain: chain as string, tokenAddress: tokenAddress as string }
  );
  res.json(history);
});

// GET /admin/treasury/aggregate
router.get("/admin/treasury/aggregate", async (req, res) => {
  const { period } = req.query;
  const entries = await service.getFeeHistory(1, 1000); // sample
  const aggregated = TreasuryAggregator.aggregate(entries, period as "daily" | "weekly" | "monthly");
  res.json(aggregated);
});

export default router;
