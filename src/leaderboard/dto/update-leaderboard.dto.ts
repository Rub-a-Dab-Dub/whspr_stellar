import { IsEnum, IsNumber, IsString, IsOptional } from 'class-validator';
import { LeaderboardCategory } from '../interfaces/leaderboard.interface';

export class UpdateLeaderboardDto {
  @IsString()
  userId: string;

  @IsEnum(LeaderboardCategory)
  category: LeaderboardCategory;

  @IsNumber()
  scoreIncrement: number;

  @IsString()
  @IsOptional()
  roomId?: string;
}