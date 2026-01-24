// room-analytics.controller.ts
import { Controller, Get, Query, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { RoomAnalyticsService } from './room-analytics.service';
import { GetAnalyticsDto } from './dto/room-analytics.dto';

@Controller('rooms/:id/analytics')
export class RoomAnalyticsController {
  constructor(private analyticsService: RoomAnalyticsService) {}

  @Get()
  async getAnalytics(
    @Param('id') roomId: string,
    @Query() dto: GetAnalyticsDto,
  ) {
    return this.analyticsService.getAnalytics(roomId, dto);
  }

  @Get('dashboard')
  async getDashboard(@Param('id') roomId: string) {
    return this.analyticsService.getDashboard(roomId);
  }

  @Get('export')
  async exportAnalytics(
    @Param('id') roomId: string,
    @Query('format') format: 'json' | 'csv' = 'json',
    @Res() res: Response,
  ) {
    const data = await this.analyticsService.exportAnalytics(roomId, format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=room-${roomId}-analytics.csv`,
      );
      return res.send(data);
    }

    return res.json(data);
  }
}

// Don't forget to add @nestjs/schedule to your module
// npm install @nestjs/schedule
// And in your module:
// import { ScheduleModule } from '@nestjs/schedule';
// imports: [ScheduleModule.forRoot(), ...]
