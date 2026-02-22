import { ApiProperty } from '@nestjs/swagger';

export class PaginatedResponseDto<T = unknown> {
  @ApiProperty({
    isArray: true,
    description: 'Array of items for the current page',
  })
  data: T[];

  @ApiProperty({
    example: 100,
    description: 'Total number of items across all pages',
  })
  total: number;

  @ApiProperty({ example: 1, description: 'Current page number (1-based)' })
  page: number;

  @ApiProperty({ example: 10, description: 'Number of items per page' })
  limit: number;
}
