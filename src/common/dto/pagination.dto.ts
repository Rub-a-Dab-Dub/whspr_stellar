import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { validationMessages } from '../../i18n/validation-messages';

export class PaginationDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt({ message: validationMessages.integer() })
  @Min(1, { message: validationMessages.min(1) })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 10 })
  @Type(() => Number)
  @IsInt({ message: validationMessages.integer() })
  @Min(1, { message: validationMessages.min(1) })
  @Max(100, { message: validationMessages.max(100) })
  @IsOptional()
  limit?: number = 10;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
