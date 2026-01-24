import { IsDateString, IsOptional, IsEnum } from 'class-validator';

export enum AnalyticsPeriod {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

export class GetAnalyticsDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period?: AnalyticsPeriod;
}

export class AnalyticsDashboardDto {
  summary!: {
    totalMessages: number;
    totalMembers: number;
    activeToday: number;
    activeThisWeek: number;
    engagementScore: number;
    growthRate: number;
    peakHour: number;
  };
  messageVolume!: Array<{ date: string; count: number }>;
  topContributors!: Array<{
    userId: string;
    username: string;
    messageCount: number;
  }>;
  hourlyActivity!: Record<string, number>;
  retentionRate!: number;
}
