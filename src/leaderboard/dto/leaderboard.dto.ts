import { IsEnum, IsOptional, IsUUID, IsNumber, Min } from 'class-validator';
import { LeaderboardType, LeaderboardPeriod } from '../entities/leaderboard-entry.entity';

export class UpdateLeaderboardScoreDto {
  @IsEnum(LeaderboardType)
  boardType: LeaderboardType;

  @IsUUID()
  userId: string;

  @IsNumber()
  @Min(0)
  score: number; // Absolute score or delta (handled by service)

  @IsOptional()
  isDelta?: boolean; // If true, add to existing; if false, set absolute

  @IsOptional()
  metadata?: Record<string, any>; // Additional context
}

export class LeaderboardEntryResponseDto {
  id: string;
  boardType: LeaderboardType;
  userId: string;
  username: string;
  avatarUrl: string;
  score: number;
  rank: number;
  period: LeaderboardPeriod;
  computedAt: Date;
  changeFromLastPeriod: number;
}

export class GetLeaderboardDto {
  @IsEnum(LeaderboardType)
  type: LeaderboardType;

  @IsEnum(LeaderboardPeriod)
  @IsOptional()
  period?: LeaderboardPeriod;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number; // Default 100, max 500
}

export class LeaderboardResponseDto {
  entries: LeaderboardEntryResponseDto[];
  total: number;
  lastUpdated: Date;
  nextResetAt: Date;
}

export class UserRankResponseDto {
  rank: number | null; // User's rank (null = not ranked)
  percentile: number; // Top X% of active users
  score: number;
  user: {
    id: string;
    username: string;
    avatarUrl: string;
  };
  nearbyUsers: Array<{
    rank: number;
    score: number;
    user: {
      id: string;
      username: string;
      avatarUrl: string;
    };
    changeFromLastPeriod?: number;
  }>; // Users ranked ±5 around this user
}

export class LeaderboardStatsResponseDto {
  totalParticipants: number;
  topScore: number;
  topUser: {
    id: string;
    username: string;
    avatarUrl: string;
  } | null;
  avgScore: number;
  medianScore: number;
}

export class LeaderboardHistoryResponseDto {
  period: LeaderboardPeriod;
  rank: number;
  score: number;
  rankChange: number;
  snapshotDate: Date;
}
