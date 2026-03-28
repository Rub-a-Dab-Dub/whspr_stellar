import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Query,
  BadRequestException,
  Type,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { MentionsService } from '../services/mentions.service';
import {
  MentionResponseDto,
  MentionListResponseDto,
  UnreadCountResponseDto,
} from '../dto/mention.dto';

@ApiTags('mentions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('mentions')
export class MentionsController {
  constructor(private readonly service: MentionsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get mentions for authenticated user',
    description: 'Returns paginated list of mentions received by the user',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 50)',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Offset (default: 0)',
  })
  @ApiResponse({
    status: 200,
    type: MentionListResponseDto,
    description: 'Paginated mentions',
  })
  async getMentions(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<MentionListResponseDto> {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const offsetNum = offset ? parseInt(offset, 10) : 0;

    if (limitNum < 1 || limitNum > 100) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }

    if (offsetNum < 0) {
      throw new BadRequestException('Offset must be non-negative');
    }

    return this.service.getMentionsForUser(userId, limitNum, offsetNum);
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Get unread mention count',
  })
  @ApiResponse({
    status: 200,
    type: UnreadCountResponseDto,
    description: 'Unread count',
  })
  async getUnreadCount(@CurrentUser('id') userId: string): Promise<UnreadCountResponseDto> {
    const unreadCount = await this.service.getUnreadCount(userId);
    return { unreadCount };
  }

  @Patch(':id/read')
  @ApiOperation({
    summary: 'Mark a mention as read',
  })
  @ApiParam({
    name: 'id',
    description: 'Mention UUID',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    type: MentionResponseDto,
    description: 'Updated mention',
  })
  async markMentionRead(
    @CurrentUser('id') userId: string,
    @Param('id', new ParseUUIDPipe()) mentionId: string,
  ): Promise<MentionResponseDto> {
    const mention = await this.service.markMentionRead(mentionId);

    // Verify user ownership
    if (mention.mentionedUserId !== userId) {
      throw new BadRequestException('You do not have permission to modify this mention');
    }

    return mention;
  }

  @Post('read-all')
  @ApiOperation({
    summary: 'Mark all mentions as read for authenticated user',
  })
  @ApiResponse({
    status: 200,
    type: Object,
    description: 'Count of mentions marked as read',
  })
  async markAllRead(@CurrentUser('id') userId: string): Promise<{ count: number }> {
    return this.service.markAllRead(userId);
  }
}
