export type LeaderboardCategory = "xp" | "tips_sent" | "tips_received" | "messages";
export type LeaderboardPeriod = "all" | "month" | "week";

export interface LeaderboardEntry {
  userId: string;
  score: number;
  rank: number;
}
