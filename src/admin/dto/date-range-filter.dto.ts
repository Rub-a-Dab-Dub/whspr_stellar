import { IsOptional, IsDateString } from 'class-validator';
import { ApiModelPropertyOptional } from '@nestjs/swagger';

export class DateRangeFilterDto {
    @ApiModelPropertyOptional({ description: 'Start date (ISO 8601 string)' })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiModelPropertyOptional({ description: 'End date (ISO 8601 string)' })
    @IsOptional()
    @IsDateString()
    endDate?: string;
}
