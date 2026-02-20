export enum LeaderboardCategory {
  XP = 'xp',
  TIPS_SENT = 'tips_sent',
  TIPS_RECEIVED = 'tips_received',
  MESSAGES = 'messages',
}

export enum LeaderboardPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  ALL_TIME = 'all_time',
}

export type LeaderboardTimeframe = LeaderboardPeriod;
export const LeaderboardTimeframe = LeaderboardPeriod;

export interface ILeaderboardEntry {
  userId: string;
  username: string;
  score: number;
  rank: number;
  category: LeaderboardCategory;
  timeframe: LeaderboardTimeframe;
  roomId?: string; // Optional for room-specific leaderboards
  isPinned?: boolean;
}