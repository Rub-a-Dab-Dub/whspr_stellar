import { IsEnum, IsOptional, IsDateString, IsString } from 'class-validator';

export enum RevenuePeriod {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
  CUSTOM = 'custom',
}

export class GetRevenueAnalyticsDto {
  @IsEnum(RevenuePeriod)
  period: RevenuePeriod;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  chain?: string;
}
