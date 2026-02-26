import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  IsArray,
  ArrayMaxSize,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class SearchRoomsDto {
  @ApiPropertyOptional({
    description: 'Full-text search across room name and description',
    example: 'crypto',
  })
  @IsOptional()
  @IsString()
  q?: string;

  /**
   * Comma-separated tags passed as a query string (?tags=defi,stellar).
   * Transformed to an array by the Transform decorator.
   */
  @ApiPropertyOptional({
    description: 'Filter by topic tags (max 5, comma-separated in URL)',
    example: 'defi,stellar',
    type: [String],
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((t: string) => t.trim())
          .filter(Boolean)
      : value,
  )
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Minimum entry fee (inclusive)',
    example: 0.01,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minFee?: number;

  @ApiPropertyOptional({
    description: 'Maximum entry fee (inclusive)',
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxFee?: number;

  @ApiPropertyOptional({
    description: 'Blockchain network identifier (e.g. "stellar")',
    example: 'stellar',
  })
  @IsOptional()
  @IsString()
  chain?: string;

  /** Cursor-based pagination: pass the `nextCursor` value from a previous response. */
  @ApiPropertyOptional({
    description: 'Pagination cursor (base64 encoded timestamp)',
    example: 'eyJjcmVhdGVkQXQiOiIyMDI1LTAxLTAxIn0=',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Number of results per page',
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}
