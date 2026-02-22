import { IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DateRangeFilterDto {
  @ApiPropertyOptional({ description: 'Start date (ISO 8601 string)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601 string)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
