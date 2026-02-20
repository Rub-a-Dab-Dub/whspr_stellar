import { IsEnum, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { LeaderboardCategory, LeaderboardTimeframe } from '../leaderboard.interface';

export class GetLeaderboardDto {
  @IsEnum(LeaderboardCategory)
  category: LeaderboardCategory;

  @IsEnum(LeaderboardTimeframe)
  @IsOptional()
  timeframe?: LeaderboardTimeframe = LeaderboardTimeframe.ALL_TIME;

  @IsString()
  @IsOptional()
  roomId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number = 0;
}