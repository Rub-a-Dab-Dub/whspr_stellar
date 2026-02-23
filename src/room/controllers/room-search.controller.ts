import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RoomSearchService } from '../services/room-search.service';
import { RoomSearchDto, TrendingRoomsDto } from '../dto/room-search.dto';

@ApiTags('rooms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rooms')
export class RoomSearchController {
  constructor(private readonly roomSearchService: RoomSearchService) {}

  @Get('search')
  @ApiOperation({
    summary: 'Search and filter public rooms',
    description:
      'Full-text search on room name/description with filters for type, category, tags, member count, and entry fee. Results are cached for 60 seconds.',
  })
  @ApiResponse({ status: 200, description: 'Paginated search results' })
  async search(
    @Query() dto: RoomSearchDto,
    @CurrentUser() user: any,
  ) {
    const userId = (user?.user ?? user)?.id;
    return this.roomSearchService.search(dto, userId);
  }

  @Get('trending')
  @ApiOperation({
    summary: 'Get trending rooms',
    description:
      'Returns rooms ranked by a trending score combining member count, growth rate, and recency. Cached for 5 minutes.',
  })
  @ApiResponse({ status: 200, description: 'List of trending rooms' })
  async trending(@Query() dto: TrendingRoomsDto) {
    return this.roomSearchService.getTrending(dto);
  }

  @Get('recommended')
  @ApiOperation({
    summary: 'Get recommended rooms for the current user',
    description:
      'Returns rooms based on the categories and tags of rooms the user has joined. Falls back to trending rooms if no preference data is available. Cached per user for 10 minutes.',
  })
  @ApiResponse({ status: 200, description: 'List of recommended rooms' })
  async recommended(
    @CurrentUser() user: any,
    @Query('limit') limit?: number,
  ) {
    const userId = (user?.user ?? user)?.id;
    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
    return this.roomSearchService.getRecommended(userId, safeLimit);
  }
}
