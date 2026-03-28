import { QRCodeService } from "../qr-code.service";

describe("QRCodeService", () => {
  const service = new QRCodeService();

  it("should generate wallet QR", async () => {
    const qr = await service.generateWalletQR("GABC123");
    expect(qr.startsWith("data:image/png;base64")).toBeTruthy();
  });

  it("should parse transfer deep link", async () => {
    const parsed = await service.parseDeepLink("gasless://pay?to=GABC&amount=10&token=XLM");
    expect(parsed.type).toBe("transfer");
    expect(parsed.to).toBe("GABC");
  });

  it("should return error for invalid deep link", async () => {
    const parsed = await service.parseDeepLink("http://malicious.com");
    expect(parsed.error).toBeDefined();
  });
});
