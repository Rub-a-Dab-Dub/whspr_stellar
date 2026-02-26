import { LeaderboardService } from "./leaderboard.service";
import { Pool } from "pg";

const pool = new Pool();
const service = new LeaderboardService();

export async function rebuildLeaderboards() {
  const client = await pool.connect();
  try {
    // Example: rebuild XP leaderboard
    const result = await client.query("SELECT user_id, SUM(xp) as total_xp FROM user_stats GROUP BY user_id");
    for (const row of result.rows) {
      await service.increment("xp", "all", row.user_id, row.total_xp);
    }
    // Repeat for tips_sent, tips_received, messages
  } finally {
    client.release();
  }
}
