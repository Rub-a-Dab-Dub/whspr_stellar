import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { AmlFlagStatus, AmlFlagType } from '../entities/aml.enums';
/* AmlFlagDto imported via aml-flag.dto - inline for pagination */

export class PaginatedAmlFlagsDto {
  @ApiProperty({ type: [AmlFlagDto] })
  @Type(() => AmlFlagDto)
  data!: AmlFlagDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}

export class ListAmlFlagsQueryDto {
  @ApiPropertyOptional({ enum: AmlFlagType })
  @IsOptional()
  @IsEnum(AmlFlagType)
  type?: AmlFlagType;

  @ApiPropertyOptional({ enum: AmlFlagStatus })
  @IsOptional()
  @IsEnum(AmlFlagStatus)
  status?: AmlFlagStatus;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  page?: number = 0;
}

