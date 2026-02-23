import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { LeaderboardService } from '../leaderboard.service';
import { GetLeaderboardDto } from '../dto/get-leaderboard.dto';
import { UpdateLeaderboardDto } from '../dto/update-leaderboard.dto';
import {
  LeaderboardCategory,
  LeaderboardPeriod,
} from '../leaderboard.interface';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('top')
  async getTopUsers(@Query() dto: GetLeaderboardDto) {
    return this.leaderboardService.getTopUsers(dto);
  }

  @Get('user/:userId')
  async getUserRank(
    @Param('userId') userId: string,
    @Query('category') category: LeaderboardCategory,
    @Query('period') period: LeaderboardPeriod,
    @Query('roomId') roomId?: string,
  ) {
    return this.leaderboardService.getUserRank(
      userId,
      category,
      period,
      roomId,
    );
  }

  @Get('stats')
  async getStats(
    @Query('category') category: LeaderboardCategory,
    @Query('period') period: LeaderboardPeriod,
    @Query('roomId') roomId?: string,
  ) {
    return this.leaderboardService.getLeaderboardStats(
      category,
      period,
      roomId,
    );
  }

  @Post('update')
  async updateLeaderboard(@Body() dto: UpdateLeaderboardDto) {
    await this.leaderboardService.updateLeaderboard(dto);
    return { success: true };
  }
}
