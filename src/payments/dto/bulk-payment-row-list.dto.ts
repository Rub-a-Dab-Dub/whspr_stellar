import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { BulkPaymentRowStatus } from '../enums/bulk-payment-row-status.enum';
import { PaginatedBulkPaymentRowsDto } from './paginated-bulk-payment-rows.dto';

export class BulkPaymentRowsQueryDto {
  @ApiPropertyOptional({ enum: BulkPaymentRowStatus })
  @IsOptional()
  @IsEnum(BulkPaymentRowStatus)
  status?: BulkPaymentRowStatus;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  page?: number = 0;
}

