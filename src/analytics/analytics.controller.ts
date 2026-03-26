import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AnalyticsRangeDto } from './dto/analytics-range.dto';
import { TransferAnalyticsQueryDto } from './dto/transfer-analytics-query.dto';
import { AnalyticsService } from './analytics.service';
import { AdminAnalyticsGuard } from './guards/admin-analytics.guard';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('admin/analytics/platform')
  @UseGuards(AdminAnalyticsGuard)
  @ApiOperation({ summary: 'Get platform analytics for the rolling 90-day window' })
  @ApiResponse({ status: 200, description: 'Platform analytics payload' })
  getPlatformAnalytics(@Query() range: AnalyticsRangeDto): Promise<Record<string, unknown>> {
    return this.analyticsService.getPlatformStats(range);
  }

  @Get('admin/analytics/users')
  @UseGuards(AdminAnalyticsGuard)
  @ApiOperation({ summary: 'Get user growth and activity analytics for the rolling 90-day window' })
  @ApiResponse({ status: 200, description: 'User analytics payload' })
  getUserAnalytics(@Query() range: AnalyticsRangeDto): Promise<Record<string, unknown>> {
    return this.analyticsService.getActiveUsers(range);
  }

  @Get('admin/analytics/transfers')
  @UseGuards(AdminAnalyticsGuard)
  @ApiOperation({ summary: 'Get transfer analytics for the rolling 90-day window' })
  @ApiResponse({ status: 200, description: 'Transfer analytics payload' })
  getTransferAnalytics(
    @Query() query: TransferAnalyticsQueryDto,
  ): Promise<Record<string, unknown>> {
    return this.analyticsService.getTransferVolume(query.token, query);
  }

  @Get('me/analytics')
  @ApiOperation({ summary: 'Get personal analytics for the authenticated user' })
  @ApiResponse({ status: 200, description: 'User analytics payload' })
  getMyAnalytics(@CurrentUser('id') userId: string): Promise<Record<string, unknown>> {
    return this.analyticsService.getUserStats(userId);
  }
}
