import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LeaderboardPeriod } from '../../leaderboard/leaderboard.interface';

export class AdminLeaderboardQueryDto {
  @ApiPropertyOptional({ enum: LeaderboardPeriod })
  @IsOptional()
  @IsEnum(LeaderboardPeriod)
  period?: LeaderboardPeriod;

  @ApiPropertyOptional({ description: 'Room ID for room-specific leaderboard' })
  @IsOptional()
  @IsString()
  roomId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 50;
}
