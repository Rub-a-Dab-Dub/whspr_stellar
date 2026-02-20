import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class ResetLeaderboardDto {
  @IsString()
  reason: string;

  @IsBoolean()
  snapshotBeforeReset: boolean;

  @IsString()
  @IsOptional()
  roomId?: string;
}
