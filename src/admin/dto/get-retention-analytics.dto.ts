import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, Max, Min } from 'class-validator';

export enum CohortPeriod {
  WEEK = 'week',
  MONTH = 'month',
}

export class GetRetentionAnalyticsDto {
  @ApiPropertyOptional({
    enum: CohortPeriod,
    default: CohortPeriod.WEEK,
  })
  @IsEnum(CohortPeriod)
  cohortPeriod: CohortPeriod = CohortPeriod.WEEK;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 12,
    default: 12,
  })
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(12)
  periods: number = 12;
}
