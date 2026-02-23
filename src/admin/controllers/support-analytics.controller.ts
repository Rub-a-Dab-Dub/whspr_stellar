import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { RoleGuard } from '../../roles/guards/role.guard';
import { Roles } from '../../roles/decorators/roles.decorator';
import { UserRole } from '../../roles/entities/role.entity';
import { SupportTicketAnalyticsService } from '../services/support-ticket-analytics.service';
import { GetAnalyticsDto } from '../dto/support-ticket/get-analytics.dto';

@ApiTags('admin-support')
@ApiBearerAuth()
@UseGuards(RoleGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@Controller('admin/support')
export class SupportAnalyticsController {
  constructor(
    private readonly analyticsService: SupportTicketAnalyticsService,
  ) {}

  @Get('analytics')
  @ApiOperation({
    summary: 'Support team SLA and performance metrics',
    description:
      'Returns ticket counts by status/category/priority, average resolution time, SLA breach count, per-assignee stats, and a daily ticket creation timeline for the requested period.',
  })
  @ApiResponse({
    status: 200,
    description: 'Aggregated analytics for the requested period',
  })
  async getAnalytics(@Query() dto: GetAnalyticsDto) {
    return this.analyticsService.getAnalytics(dto.period);
  }
}
