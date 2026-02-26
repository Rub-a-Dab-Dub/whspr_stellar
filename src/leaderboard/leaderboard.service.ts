import Redis from "ioredis";
import { LeaderboardCategory, LeaderboardPeriod, LeaderboardEntry } from "./leaderboard.types";

const redis = new Redis();

export class LeaderboardService {
  private key(category: LeaderboardCategory, period: LeaderboardPeriod, roomId?: string) {
    return `leaderboard:${category}:${period}${roomId ? `:${roomId}` : ""}`;
  }

  async increment(category: LeaderboardCategory, period: LeaderboardPeriod, userId: string, amount = 1, roomId?: string) {
    await redis.zincrby(this.key(category, period, roomId), amount, userId);
  }

  async getTop(category: LeaderboardCategory, period: LeaderboardPeriod, roomId?: string, limit = 100): Promise<LeaderboardEntry[]> {
    const key = this.key(category, period, roomId);
    const results = await redis.zrevrange(key, 0, limit - 1, "WITHSCORES");
    const entries: LeaderboardEntry[] = [];
    for (let i = 0; i < results.length; i += 2) {
      entries.push({ userId: results[i], score: Number(results[i + 1]), rank: i / 2 + 1 });
    }
    return entries;
  }

  async getUserRank(category: LeaderboardCategory, period: LeaderboardPeriod, userId: string, roomId?: string): Promise<LeaderboardEntry | null> {
    const key = this.key(category, period, roomId);
    const rank = await redis.zrevrank(key, userId);
    const score = await redis.zscore(key, userId);
    if (rank !== null && score !== null) {
      return { userId, score: Number(score), rank: rank + 1 };
    }
    return null;
  }
}
