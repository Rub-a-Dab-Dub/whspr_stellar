export enum LeaderboardCategory {
  XP = 'xp',
  TIPS_SENT = 'tips_sent',
  MESSAGES = 'messages',
}

export enum LeaderboardTimeframe {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  ALL_TIME = 'all_time',
}

export interface ILeaderboardEntry {
  userId: string;
  username: string;
  score: number;
  rank: number;
  category: LeaderboardCategory;
  timeframe: LeaderboardTimeframe;
  roomId?: string; // Optional for room-specific leaderboards
}