import { PrivacyService } from "../privacy.service";

describe("PrivacyService", () => {
  const service = new PrivacyService();

  it("should not allow multiple active export requests", async () => {
    await service.requestDataExport("user1");
    await expect(service.requestDataExport("user1")).rejects.toThrow();
  });

  it("should expire download link after 48h", async () => {
    const status = await service.getExportStatus("user1");
    status.expiresAt = new Date(Date.now() - 1000);
    const link = await service.downloadExport("user1");
    expect(link).toBeNull();
  });

  it("should anonymize user account", async () => {
    await service.deleteAccount("user2");
    // assert anonymization logic
  });
});
