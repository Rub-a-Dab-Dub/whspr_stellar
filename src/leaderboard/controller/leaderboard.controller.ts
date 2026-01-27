import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { GetLeaderboardDto } from './dto/get-leaderboard.dto';
import { UpdateLeaderboardDto } from './dto/update-leaderboard.dto';
import { LeaderboardCategory, LeaderboardTimeframe } from './interfaces/leaderboard.interface';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('top')
  async getTopUsers(@Query() dto: GetLeaderboardDto) {
    return this.leaderboardService.getTopUsers(dto);
  }

  @Get('user/:userId')
  async getUserRank(
    @Query('userId') userId: string,
    @Query('category') category: LeaderboardCategory,
    @Query('timeframe') timeframe: LeaderboardTimeframe,
    @Query('roomId') roomId?: string,
  ) {
    return this.leaderboardService.getUserRank(userId, category, timeframe, roomId);
  }

  @Get('stats')
  async getStats(
    @Query('category') category: LeaderboardCategory,
    @Query('timeframe') timeframe: LeaderboardTimeframe,
    @Query('roomId') roomId?: string,
  ) {
    return this.leaderboardService.getLeaderboardStats(category, timeframe, roomId);
  }

  @Post('update')
  async updateLeaderboard(@Body() dto: UpdateLeaderboardDto) {
    await this.leaderboardService.updateLeaderboard(dto);
    return { success: true };
  }

  @Post('reset/:timeframe')
  async resetLeaderboard(@Query('timeframe') timeframe: LeaderboardTimeframe) {
    await this.leaderboardService.resetLeaderboard(timeframe);
    return { success: true, message: `${timeframe} leaderboard reset` };
  }
}