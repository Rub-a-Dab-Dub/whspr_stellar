import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class AnalyticsRangeDto {
  @ApiPropertyOptional({ example: '2026-03-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-03-24' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
