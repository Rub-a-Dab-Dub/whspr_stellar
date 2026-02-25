import { BadgeService } from "../badge.service";

describe("BadgeService award logic", () => {
  it("awards a badge to a user", async () => {
    const service = new BadgeService();
    service["badges"].push({
      id: "b1",
      name: "Quest Starter",
      description: "Completed your first quest",
      imageIpfsHash: "Qm123",
      rarity: "COMMON",
      questId: "q1",
    });

    const userBadge = await service.awardBadge("u1", "b1");
    expect(userBadge.userId).toBe("u1");
    expect(userBadge.badgeId).toBe("b1");
    expect(userBadge.nftTokenId).toBeNull();
  });
});
