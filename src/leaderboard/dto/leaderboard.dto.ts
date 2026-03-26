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
  boardType: LeaderboardType;
  period: LeaderboardPeriod;
  entries: LeaderboardEntryResponseDto[];
  total: number;
  lastUpdated: Date;
  nextResetAt: Date;
}

export class UserRankResponseDto {
  userId: string;
  username: string;
  rank: number; // User's rank (null = not ranked)
  score: number;
  boardType: LeaderboardType;
  period: LeaderboardPeriod;
  percentile: number; // Top X% of active users
  nearbyUsers: LeaderboardEntryResponseDto[]; // Users ranked ±5 around this user
}

export class LeaderboardStatsResponseDto {
  boardType: LeaderboardType;
  totalParticipants: number;
  topScore: number;
  topUser: { userId: string; username: string; score: number };
  averageScore: number;
  medianScore: number;
  lastComputedAt: Date;
  nextResetAt: Date;
}

export class LeaderboardHistoryResponseDto {
  userId: string;
  username: string;
  boardType: LeaderboardType;
  history: Array<{
    period: LeaderboardPeriod;
    rank: number;
    score: number;
    snapshotDate: Date;
    rankChange: number;
  }>;
}
