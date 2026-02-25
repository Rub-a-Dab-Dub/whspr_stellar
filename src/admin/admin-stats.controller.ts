import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminStatsService } from './admin-stats.service';
import { AdminGuard } from './guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StatsQueryDto } from './dto/stats-query.dto';

@Controller('admin/stats')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminStatsController {
  constructor(private readonly statsService: AdminStatsService) {}

  @Get('overview')
  async getOverview() {
    return this.statsService.getOverview();
  }

  @Get('users')
  async getUserStats(@Query() query: StatsQueryDto) {
    return this.statsService.getUserStats(query);
  }

  @Get('messages')
  async getMessageStats(@Query() query: StatsQueryDto) {
    return this.statsService.getMessageStats(query);
  }

  @Get('payments')
  async getPaymentStats(@Query() query: StatsQueryDto) {
    return this.statsService.getPaymentStats(query);
  }

  @Get('rooms')
  async getRoomStats() {
    return this.statsService.getRoomStats();
  }
}
