import { IsEnum, IsOptional, IsDateString, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum RevenuePeriod {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
  CUSTOM = 'custom',
}

export class GetRevenueAnalyticsDto {
  @ApiProperty({ enum: RevenuePeriod })
  @IsEnum(RevenuePeriod)
  period: RevenuePeriod;

  @ApiPropertyOptional({ example: '2024-01-01', description: 'Required for CUSTOM period' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2024-12-31', description: 'Required for CUSTOM period' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Filter by blockchain network' })
  @IsOptional()
  @IsString()
  chain?: string;
}
