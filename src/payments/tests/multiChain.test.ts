import { EvmProviderService } from "../evmProvider.service";

describe("Multi-chain detection", () => {
  it("detects chain from tx hash", async () => {
    const service = new EvmProviderService();
    jest.spyOn(service, "getProvider").mockResolvedValue({
      getTransaction: async () => ({ hash: "0x123" }),
    } as any);
    const chain = await service.detectChain("0x123");
    expect(chain).toBeDefined();
  });

  it("falls back to secondary RPC if primary fails", async () => {
    const service = new EvmProviderService();
    jest.spyOn(service, "getProvider").mockImplementation(async (chain) => {
      throw new Error("Primary failed");
    });
    await expect(service.detectChain("0xabc")).resolves.toBeNull();
  });
});
