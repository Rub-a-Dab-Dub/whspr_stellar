import { Router } from "express";
import { PaymentService } from "./payment.service";

const router = Router();
const service = new PaymentService();

// POST /payments/verify
router.post("/payments/verify", async (req, res) => {
  const { txHash, amount, tokenAddress } = req.body;
  try {
    const record = await service.verifyAndRecord(txHash, amount, tokenAddress);
    res.json(record);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
