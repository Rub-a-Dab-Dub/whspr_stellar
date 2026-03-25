import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AnalyticsRangeDto } from './analytics-range.dto';

export class TransferAnalyticsQueryDto extends AnalyticsRangeDto {
  @ApiPropertyOptional({ example: 'USDC' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  token?: string;
}
