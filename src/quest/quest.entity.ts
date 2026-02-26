export type QuestType = "DAILY" | "WEEKLY" | "ONE_TIME";

export interface Quest {
  id: string;
  title: string;
  description: string;
  type: QuestType;
  xpReward: number;
  requirement: Record<string, any>; // e.g. { action: "send_messages", target: 10 }
  badgeId?: string;
}
