import { IsEnum, IsNumber, IsString, IsOptional } from 'class-validator';
import { LeaderboardCategory } from '../leaderboard.interface';

export class UpdateLeaderboardDto {
  @IsString()
  userId: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsEnum(LeaderboardCategory)
  category: LeaderboardCategory;

  @IsNumber()
  scoreIncrement: number;

  @IsString()
  @IsOptional()
  roomId?: string;
}
