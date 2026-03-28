import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SpamDetectionService } from './spam-detection.service';
import {
  ScoreMessageDto,
  ScoreUserDto,
  FlagContentDto,
  AdminReviewDto,
  SpamScoreResponseDto,
  SpamStatsResponseDto,
  SpamQueueResponseDto,
} from './dto/spam.dto';

@ApiTags('spam-detection')
@Controller('admin/spam')
@ApiBearerAuth()
export class SpamDetectionController {
  private readonly logger = new Logger(SpamDetectionController.name);

  constructor(private readonly spamDetectionService: SpamDetectionService) {}

  /**
   * Queue message for spam scoring (async)
   * Internal endpoint - called after message delivery
   */
  @Post('score-message')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Queue message for spam analysis (async)' })
  async scoreMessage(@Body() dto: ScoreMessageDto): Promise<{ jobId: string; status: string }> {
    return this.spamDetectionService.scoreMessage(dto);
  }

  /**
   * Manually score a user (triggers immediate recalculation)
   */
  @Post('score-user')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger user spam score recalculation' })
  async scoreUser(@Body() dto: ScoreUserDto): Promise<SpamScoreResponseDto> {
    return this.spamDetectionService.scoreUser(dto);
  }

  /**
   * Flag content as spam/abuse (user report)
   */
  @Post('flag-content')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Flag content as spam/abuse' })
  async flagContent(@Body() dto: FlagContentDto): Promise<SpamScoreResponseDto> {
    return this.spamDetectionService.flagContent(dto);
  }

  /**
   * Get pending admin review queue
   * Shows flagged users that need human review
   */
  @Get('queue')
  @ApiOperation({ summary: 'Get pending spam review queue (admin only)' })
  async getReviewQueue(@Query('limit') limit: number = 50): Promise<SpamQueueResponseDto[]> {
    return this.spamDetectionService.getPendingReviewQueue(Math.min(limit, 100));
  }

  /**
   * Admin review: approve, reject as false positive, or adjust score
   */
  @Patch(':id/review')
  @ApiOperation({ summary: 'Admin review spam score (approve/reject/adjust)' })
  async reviewSpamScore(
    @Param('id') id: string,
    @Body() dto: AdminReviewDto,
    @Request() req: any,
  ): Promise<SpamScoreResponseDto> {
    // In production, verify admin role
    const reviewedBy = req.user?.id || 'system';
    return this.spamDetectionService.reviewSpamScore(id, reviewedBy, dto);
  }

  /**
   * Get spam detection statistics
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get spam detection statistics and trends' })
  async getStats(): Promise<SpamStatsResponseDto> {
    return this.spamDetectionService.getSpamStats() as any;
  }

  /**
   * Get spam history for a user
   */
  @Get('history/:userId')
  @ApiOperation({ summary: 'Get spam score history for a user' })
  async getUserHistory(
    @Param('userId') userId: string,
    @Query('limit') limit: number = 20,
  ): Promise<SpamScoreResponseDto[]> {
    return this.spamDetectionService.getSpamHistory(userId, Math.min(limit, 100));
  }
}
