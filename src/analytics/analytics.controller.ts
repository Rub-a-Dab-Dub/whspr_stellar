import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsAggregationService } from './analytics-aggregation.service';
import { QueryEventsDto } from './dto/query-events.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../admin/guards/admin.guard';

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AnalyticsController {
  constructor(
    private readonly aggregationService: AnalyticsAggregationService,
  ) {}

  @Get('events')
  async getEvents(@Query() query: QueryEventsDto) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    return this.aggregationService.getEventStats(
      query.type,
      query.userId,
      from,
      to,
    );
  }
}
