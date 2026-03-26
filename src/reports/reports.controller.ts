import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ModerationQueueItemDto } from './dto/moderation-queue-item.dto';
import { ReportResponseDto } from './dto/report-response.dto';
import { SubmitReportDto } from './dto/submit-report.dto';
import { AdminReportsGuard } from './guards/admin-reports.guard';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('reports')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a content report' })
  @ApiResponse({ status: 201, type: ReportResponseDto })
  async submitReport(
    @CurrentUser('id') reporterId: string,
    @Body() dto: SubmitReportDto,
  ): Promise<ReportResponseDto> {
    return this.reportsService.submitReport(reporterId, dto);
  }

  @Get('admin/reports')
  @ApiBearerAuth()
  @UseGuards(AdminReportsGuard)
  @ApiOperation({ summary: 'Get moderation queue' })
  @ApiResponse({ status: 200, type: ModerationQueueItemDto, isArray: true })
  async getModerationQueue(): Promise<ModerationQueueItemDto[]> {
    return this.reportsService.getModerationQueue();
  }

  @Patch('admin/reports/:id/review')
  @ApiBearerAuth()
  @UseGuards(AdminReportsGuard)
  @ApiOperation({ summary: 'Mark a report as reviewed' })
  @ApiResponse({ status: 200, type: ReportResponseDto })
  async reviewReport(
    @Param('id', ParseUUIDPipe) reportId: string,
    @CurrentUser('id') adminId: string,
  ): Promise<ReportResponseDto> {
    return this.reportsService.reviewReport(reportId, adminId);
  }

  @Patch('admin/reports/:id/dismiss')
  @ApiBearerAuth()
  @UseGuards(AdminReportsGuard)
  @ApiOperation({ summary: 'Dismiss a report' })
  @ApiResponse({ status: 200, type: ReportResponseDto })
  async dismissReport(
    @Param('id', ParseUUIDPipe) reportId: string,
    @CurrentUser('id') adminId: string,
  ): Promise<ReportResponseDto> {
    return this.reportsService.dismissReport(reportId, adminId);
  }

  @Patch('admin/reports/:id/action')
  @ApiBearerAuth()
  @UseGuards(AdminReportsGuard)
  @ApiOperation({ summary: 'Apply moderation action to a report target' })
  @ApiResponse({ status: 200, type: ReportResponseDto })
  async actionReport(
    @Param('id', ParseUUIDPipe) reportId: string,
    @CurrentUser('id') adminId: string,
  ): Promise<ReportResponseDto> {
    return this.reportsService.actionReport(reportId, adminId);
  }
}
