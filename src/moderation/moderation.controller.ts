import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Request,
  HttpCode,
  HttpStatus,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ModerationService } from '../services/moderation.service';
import {
  BlockUserDto,
  CreateReportDto,
  ReviewReportDto,
  AppealReportDto,
} from '../dto/moderation.dto';
import { ReportStatus } from '../entities/report.entity';

@ApiTags('users')
@Controller('users')
// @UseGuards(JwtAuthGuard) - Add your auth guard
export class BlockingController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post(':id/block')
  @ApiOperation({ summary: 'Block a user' })
  @ApiResponse({ status: 201, description: 'User blocked successfully' })
  @ApiBearerAuth()
  async blockUser(
    @Request() req,
    @Param('id') blockedUserId: string,
    @Body() blockDto: BlockUserDto,
  ) {
    const blockerId = req.user?.id || 'demo-user';
    return this.moderationService.blockUser(
      blockerId,
      blockedUserId,
      blockDto.reason,
    );
  }

  @Delete(':id/unblock')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unblock a user' })
  @ApiResponse({ status: 204, description: 'User unblocked successfully' })
  @ApiBearerAuth()
  async unblockUser(@Request() req, @Param('id') blockedUserId: string) {
    const blockerId = req.user?.id || 'demo-user';
    await this.moderationService.unblockUser(blockerId, blockedUserId);
  }

  @Get('blocked')
  @ApiOperation({ summary: 'Get list of blocked users' })
  @ApiResponse({ status: 200, description: 'List of blocked users' })
  @ApiBearerAuth()
  async getBlockedUsers(@Request() req) {
    const userId = req.user?.id || 'demo-user';
    return this.moderationService.getBlockedUsers(userId);
  }

  @Get(':id/is-blocked')
  @ApiOperation({ summary: 'Check if a user is blocked' })
  @ApiResponse({ status: 200, description: 'Block status' })
  @ApiBearerAuth()
  async isBlocked(@Request() req, @Param('id') targetUserId: string) {
    const userId = req.user?.id || 'demo-user';
    const blocked = await this.moderationService.isBlocked(
      userId,
      targetUserId,
    );
    return { blocked };
  }
}

@ApiTags('reports')
@Controller('reports')
// @UseGuards(JwtAuthGuard) - Add your auth guard
export class ReportController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post('users/:id')
  @ApiOperation({ summary: 'Report a user' })
  @ApiResponse({ status: 201, description: 'Report created successfully' })
  @ApiBearerAuth()
  async createReport(
    @Request() req,
    @Param('id') reportedUserId: string,
    @Body() createDto: CreateReportDto,
  ) {
    const reporterId = req.user?.id || 'demo-user';
    return this.moderationService.createReport(
      reporterId,
      reportedUserId,
      createDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all reports (admin only)' })
  @ApiResponse({ status: 200, description: 'List of reports' })
  @ApiBearerAuth()
  // @UseGuards(AdminGuard)
  async getReports(@Query('status') status?: ReportStatus) {
    return this.moderationService.getReports(status);
  }

  @Post(':id/review')
  @ApiOperation({ summary: 'Review a report (admin only)' })
  @ApiResponse({ status: 200, description: 'Report reviewed' })
  @ApiBearerAuth()
  // @UseGuards(AdminGuard)
  async reviewReport(
    @Request() req,
    @Param('id') reportId: string,
    @Body() reviewDto: ReviewReportDto,
  ) {
    const reviewerId = req.user?.id || 'demo-admin';
    return this.moderationService.reviewReport(reportId, reviewerId, reviewDto);
  }

  @Post(':id/appeal')
  @ApiOperation({ summary: 'Appeal a report decision' })
  @ApiResponse({ status: 200, description: 'Appeal submitted' })
  @ApiBearerAuth()
  async appealReport(
    @Param('id') reportId: string,
    @Body() appealDto: AppealReportDto,
  ) {
    return this.moderationService.appealReport(
      reportId,
      appealDto.appealReason,
    );
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get report analytics (admin only)' })
  @ApiResponse({ status: 200, description: 'Report analytics' })
  @ApiBearerAuth()
  // @UseGuards(AdminGuard)
  async getAnalytics() {
    return this.moderationService.getReportAnalytics();
  }
}
