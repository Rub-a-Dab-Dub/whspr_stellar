import { IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export type AnalyticsPeriod = '7d' | '14d' | '30d' | '90d' | '365d';

export class GetAnalyticsDto {
  @ApiPropertyOptional({
    description: 'Time window for the analytics data',
    enum: ['7d', '14d', '30d', '90d', '365d'],
    default: '30d',
  })
  @IsOptional()
  @IsIn(['7d', '14d', '30d', '90d', '365d'])
  period?: AnalyticsPeriod = '30d';
}
