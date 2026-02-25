import { QuestService } from "../quest.service";

describe("QuestService", () => {
  it("auto-completes quest when progress >= target", async () => {
    const service = new QuestService();
    service["quests"].push({
      id: "q1",
      title: "Send 3 messages",
      description: "Send three messages",
      type: "DAILY",
      xpReward: 50,
      requirement: { action: "send_messages", target: 3 },
    });

    await service.incrementProgress("u1", "q1", 1);
    await service.incrementProgress("u1", "q1", 2);

    const active = await service.getActiveQuests("u1");
    expect(active.length).toBe(0); // quest completed
  });
});
