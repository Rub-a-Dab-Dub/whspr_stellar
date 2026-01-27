import { IsString, IsInt, Min, Max, IsOptional } from 'class-validator';

export class CreateTimedRoomDto {
  @IsString()
  name: string;

  @IsInt()
  @Min(5) // Minimum 5 minutes
  @Max(10080) // Maximum 7 days (in minutes)
  durationMinutes: number;

  @IsOptional()
  @IsString()
  stellarTransactionId?: string; // Link to blockchain transaction
}

export class ExtendRoomDto {
  @IsInt()
  @Min(5)
  @Max(1440) // Max 24 hours extension
  additionalMinutes: number;
}