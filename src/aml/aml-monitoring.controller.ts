import { Controller, Get, Patch, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AmlMonitoringService } from './aml-monitoring.service';
import { ListAmlFlagsQueryDto, PaginatedAmlFlagsDto } from './dto/paginated-aml-flags.dto';
import { ReviewFlagDto } from './dto/aml-flag.dto';
import { GenerateReportDto } from './dto/generate-report.dto';
import { AmlDashboardDto } from './dto/aml-dashboard.dto';
import { AmlFlagDto } from './dto/aml-flag.dto';
import { ComplianceReportType } from './entities/aml.enums';

@ApiTags('admin/aml')
@Controller('admin/aml')
@UseGuards(AdminGuard)
@ApiBearerAuth()
export class AmlMonitoringController {
  constructor(private readonly service: AmlMonitoringService) {}

  @Get('flags')
  @ApiOperation({ summary: 'List AML flags' })
  @ApiQuery({ name: 'type', enum: String, required: false })
  @ApiQuery({ name: 'status', enum: String, required: false })
  @ApiResponse({ status: 200, type: PaginatedAmlFlagsDto })
  async getFlags(@Query() query: ListAmlFlagsQueryDto): Promise<PaginatedAmlFlagsDto> {
    // Delegate to service/repo
    return { data: [], total: 0, page: 0, limit: 0 }; // TODO
  }

  @Patch('flags/:id')
  @ApiOperation({ summary: 'Review/update flag status' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: ReviewFlagDto })
  @ApiResponse({ status: 200, type: AmlFlagDto })
  async reviewFlag(
    @Param('id') id: string,
    @Body() dto: ReviewFlagDto,
    @CurrentUser('id') reviewerId: string,
  ): Promise<AmlFlagDto> {
    return this.service.reviewFlag(id, dto.action, reviewerId, dto.notes);
  }

  @Post('reports/generate')
  @ApiOperation({ summary: 'Generate SAR/CTR report' })
  @ApiBody({ type: GenerateReportDto })
  async generateReport(@Body() dto: GenerateReportDto) {
    return this.service.generateReport(dto.type, dto.period);
  }

  @Get('reports')
  @ApiOperation({ summary: 'List compliance reports' })
  async getReports() {
    // TODO
    return [];
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'AML dashboard stats' })
  @ApiResponse({ type: AmlDashboardDto })
  async getDashboard(): Promise<AmlDashboardDto> {
    return this.service.getAMLDashboard();
  }
}

