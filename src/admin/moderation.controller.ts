import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { CreateReportDto } from './dto/create-report.dto';
import { GetReportsDto } from './dto/get-reports.dto';
import { ReviewReportDto } from './dto/review-report.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { RemoveRoomDto } from './dto/remove-room.dto';

@Controller()
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post('reports')
  @UseGuards(JwtAuthGuard)
  async createReport(@Request() req, @Body() dto: CreateReportDto) {
    return this.moderationService.createReport(req.user.id, dto);
  }

  @Get('admin/reports')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getReports(@Query() dto: GetReportsDto) {
    return this.moderationService.getReports(dto);
  }

  @Patch('admin/reports/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async reviewReport(@Param('id') id: string, @Request() req, @Body() dto: ReviewReportDto) {
    return this.moderationService.reviewReport(id, req.user.id, dto);
  }

  @Post('admin/users/:id/ban')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async banUser(@Param('id') id: string, @Request() req, @Body() dto: BanUserDto) {
    return this.moderationService.banUser(id, req.user.id, dto);
  }

  @Post('admin/rooms/:id/remove')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async removeRoom(@Param('id') id: string, @Request() req, @Body() dto: RemoveRoomDto) {
    return this.moderationService.removeRoom(id, req.user.id, dto);
  }
}
