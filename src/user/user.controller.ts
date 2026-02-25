import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { UserXpService } from '../xp/user-xp.service';
import { XpHistoryQueryDto } from '../xp/dto/xp-history-query.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(private readonly userXpService: UserXpService) {}

  /**
   * GET /users/:id/xp-history
   * Paginated XP transaction history for a user.
   */
  @Get(':id/xp-history')
  @ApiOperation({
    summary: 'Get paginated XP transaction history for a user',
    description:
      'Returns all XP award events ordered most recent first, ' +
      'along with current xpTotal and level.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({
    status: 200,
    description: 'XP history returned successfully',
    schema: {
      example: {
        xpTotal: 1250,
        level: 2,
        total: 8,
        transactions: [
          {
            id: 'uuid',
            userId: 'uuid',
            amount: 10,
            reason: 'send_message',
            meta: null,
            xpAfter: 1250,
            levelAfter: 2,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getXpHistory(
    @Param('id', ParseUUIDPipe) userId: string,
    @Query() query: XpHistoryQueryDto,
  ) {
    return this.userXpService.getHistory(userId, query.limit, query.offset);
  }
}
