import { IsBoolean, IsEnum, IsString, IsOptional } from 'class-validator';
import { LeaderboardCategory, LeaderboardPeriod } from '../../leaderboard/leaderboard.interface';

export class SetPinnedDto {
  @IsString()
  userId: string;

  @IsEnum(LeaderboardCategory)
  category: LeaderboardCategory;

  @IsEnum(LeaderboardPeriod)
  period: LeaderboardPeriod;

  @IsBoolean()
  isPinned: boolean;

  @IsString()
  @IsOptional()
  roomId?: string;
}
