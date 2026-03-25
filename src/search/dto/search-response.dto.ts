import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SearchType } from './search-query.dto';

export class SearchResultItem {
  @ApiProperty({ description: 'Result entity UUID' })
  id!: string;

  @ApiProperty({ enum: SearchType, description: 'Entity type' })
  type!: SearchType;

  @ApiProperty({ description: 'Result data payload' })
  data!: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Highlighted snippet matching the search query' })
  highlight?: string;

  @ApiProperty({ description: 'Relevance rank score from ts_rank' })
  rank!: number;
}

export class SearchResponseDto {
  @ApiProperty({ type: [SearchResultItem] })
  results!: SearchResultItem[];

  @ApiProperty({ description: 'Total matching results count' })
  total!: number;

  @ApiPropertyOptional({ description: 'Cursor for fetching the next page' })
  nextCursor?: string;

  @ApiProperty({ description: 'Query execution time in milliseconds' })
  took!: number;
}

export type SearchResultData = { rows: SearchResultItem[]; total: number };
