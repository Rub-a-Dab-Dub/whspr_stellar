import { LeaderboardService } from "../leaderboard.service";

describe("LeaderboardService", () => {
  it("increments and retrieves leaderboard entries", async () => {
    const service = new LeaderboardService();
    await service.increment("xp", "all", "user1", 10);
    await service.increment("xp", "all", "user2", 20);

    const top = await service.getTop("xp", "all");
    expect(top[0].userId).toBe("user2");
    expect(top[0].score).toBe(20);

    const userRank = await service.getUserRank("xp", "all", "user1");
    expect(userRank?.rank).toBe(2);
  });
});
