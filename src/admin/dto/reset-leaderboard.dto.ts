import { IsString, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResetLeaderboardDto {
  @ApiProperty({ description: 'Reason for reset (audit trail)' })
  @IsString()
  reason: string;

  @ApiProperty({
    description: 'Whether to snapshot current state before reset',
  })
  @IsBoolean()
  snapshotBeforeReset: boolean;

  @ApiPropertyOptional({ description: 'Room ID for room-specific leaderboard' })
  @IsString()
  @IsOptional()
  roomId?: string;
}
