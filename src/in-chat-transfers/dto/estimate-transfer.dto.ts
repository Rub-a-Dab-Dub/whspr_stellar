import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';

export class EstimateTransferDto {
  @ApiPropertyOptional({ example: 'XLM', default: 'XLM' })
  @IsOptional()
  @IsString()
  asset?: string;

  @ApiPropertyOptional({ example: 10 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  recipientCount?: number;
}
