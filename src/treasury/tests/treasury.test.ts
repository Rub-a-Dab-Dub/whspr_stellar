import { TreasuryService } from "../treasury.service";

describe("TreasuryService fee calculation", () => {
  it("handles rounding and dust amounts correctly", async () => {
    const service = new TreasuryService();
    await service.recordFee({
      id: "1",
      txHash: "0xabc",
      feeAmount: "1",
      tokenAddress: "0xtoken",
      chain: "ETH",
      source: "TIP",
      collectedAt: new Date(),
    });
    await service.recordFee({
      id: "2",
      txHash: "0xdef",
      feeAmount: "2",
      tokenAddress: "0xtoken",
      chain: "ETH",
      source: "ROOM_ENTRY",
      collectedAt: new Date(),
    });
    const totals = await service.getTotalFeesByTokenAndChain();
    expect(totals["ETH"]["0xtoken"]).toBe(3n);
  });
});
