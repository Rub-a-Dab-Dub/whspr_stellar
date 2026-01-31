import { IsBooleanString, IsOptional } from 'class-validator';

export class UserStatsQueryDto {
  @IsOptional()
  @IsBooleanString()
  includeComparison?: string;
}
