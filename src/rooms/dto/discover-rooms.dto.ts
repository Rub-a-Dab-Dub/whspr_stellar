import { IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class DiscoverRoomsDto {
  /** Cursor-based pagination: pass the `nextCursor` value from a previous response. */
  @ApiPropertyOptional({
    description: 'Pagination cursor (base64 encoded trendingScore + id)',
    example: 'eyJ0cmVuZGluZ1Njb3JlIjo1MDAsImlkIjoiMTIzIn0=',
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
