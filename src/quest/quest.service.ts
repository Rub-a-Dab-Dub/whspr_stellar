import { Quest } from "./quest.entity";
import { UserQuest } from "./userQuest.entity";

export class QuestService {
  private quests: Quest[] = [];
  private userQuests: UserQuest[] = [];

  async getAllQuests(userId: string): Promise<(Quest & { progress: number; completedAt?: Date })[]> {
    return this.quests.map((q) => {
      const uq = this.userQuests.find((u) => u.userId === userId && u.questId === q.id);
      return { ...q, progress: uq?.progress || 0, completedAt: uq?.completedAt };
    });
  }

  async getActiveQuests(userId: string): Promise<UserQuest[]> {
    return this.userQuests.filter((uq) => uq.userId === userId && !uq.completedAt);
  }

  async incrementProgress(userId: string, questId: string, amount = 1) {
    const uq = this.userQuests.find((u) => u.userId === userId && u.questId === questId);
    if (!uq) {
      this.userQuests.push({ id: crypto.randomUUID(), userId, questId, progress: amount, completedAt: null });
      return;
    }
    uq.progress += amount;

    const quest = this.quests.find((q) => q.id === questId);
    if (quest && uq.progress >= quest.requirement.target && !uq.completedAt) {
      uq.completedAt = new Date();
      await this.awardCompletion(userId, quest);
    }
  }

  async awardCompletion(userId: string, quest: Quest) {
    // Award XP
    await awardXp(userId, quest.xpReward);

    // Award badge if applicable
    if (quest.badgeId) {
      await awardBadge(userId, quest.badgeId);
    }
  }
}
