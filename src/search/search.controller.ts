import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchQueryDto, SearchType } from './dto/search-query.dto';
import { SearchResponseDto } from './dto/search-response.dto';

@ApiTags('search')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Global full-text search',
    description:
      'Search across users, groups, messages, and tokens using PostgreSQL full-text search. ' +
      'Results are ranked by relevance (ts_rank). Supports cursor-based pagination.',
  })
  @ApiQuery({ name: 'q', description: 'Search query string', required: true })
  @ApiQuery({ name: 'type', enum: SearchType, required: false, description: 'Filter by entity type' })
  @ApiQuery({ name: 'limit', type: Number, required: false, description: 'Max results (1–50, default 20)' })
  @ApiQuery({ name: 'cursor', type: String, required: false, description: 'Pagination cursor' })
  @ApiQuery({ name: 'groupId', type: String, required: false, description: 'Scope message search to a group' })
  @ApiQuery({ name: 'dateFrom', type: String, required: false, description: 'Start date filter (ISO 8601)' })
  @ApiQuery({ name: 'dateTo', type: String, required: false, description: 'End date filter (ISO 8601)' })
  @ApiOkResponse({ type: SearchResponseDto })
  async search(@Query() dto: SearchQueryDto): Promise<SearchResponseDto> {
    return this.searchService.search(dto);
  }
}
