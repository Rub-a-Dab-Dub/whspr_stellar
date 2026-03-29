import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class WarmContractCacheDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  userLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(1_000)
  @Max(120_000)
  maxDurationMs?: number;
}
