import { IsBoolean, IsEnum, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  LeaderboardCategory,
  LeaderboardPeriod,
} from '../../leaderboard/leaderboard.interface';

export class SetPinnedDto {
  @ApiProperty({ description: 'User ID to pin/unpin' })
  @IsString()
  userId: string;

  @ApiProperty({ enum: LeaderboardCategory })
  @IsEnum(LeaderboardCategory)
  category: LeaderboardCategory;

  @ApiProperty({ enum: LeaderboardPeriod })
  @IsEnum(LeaderboardPeriod)
  period: LeaderboardPeriod;

  @ApiProperty({ description: 'Whether to pin (true) or unpin (false)' })
  @IsBoolean()
  isPinned: boolean;

  @ApiPropertyOptional({ description: 'Room ID for room-specific leaderboard' })
  @IsString()
  @IsOptional()
  roomId?: string;
}
