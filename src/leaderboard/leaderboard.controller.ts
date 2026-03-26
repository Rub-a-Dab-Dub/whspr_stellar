import { Controller, Get, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardPeriod, LeaderboardType } from './entities/leaderboard-entry.entity';
import {
  GetLeaderboardDto,
  LeaderboardResponseDto,
  UserRankResponseDto,
  LeaderboardStatsResponseDto,
  LeaderboardHistoryResponseDto,
} from './dto/leaderboard.dto';

@ApiTags('Leaderboards')
@Controller('leaderboards')
export class LeaderboardController {
  constructor(private leaderboardService: LeaderboardService) {}

  @Get(':type')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get leaderboard by type' })
  @ApiResponse({
    status: 200,
    description: 'Leaderboard retrieved successfully',
    type: LeaderboardResponseDto,
  })
  async getLeaderboard(
    @Param('type') type: LeaderboardType,
    @Query('period') period: LeaderboardPeriod = LeaderboardPeriod.WEEKLY,
    @Query('limit') limit: number = 100,
  ): Promise<LeaderboardResponseDto> {
    return this.leaderboardService.getLeaderboard(type, period, limit);
  }

  @Get(':type/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get user's rank on leaderboard" })
  @ApiResponse({
    status: 200,
    description: "User's rank retrieved successfully",
    type: UserRankResponseDto,
  })
  async getUserRank(
    @Param('type') type: LeaderboardType,
    @Query('period') period: LeaderboardPeriod = LeaderboardPeriod.WEEKLY,
    @CurrentUser() user: User,
  ): Promise<UserRankResponseDto | null> {
    return this.leaderboardService.getUserRank(user.id, type, period);
  }

  @Get(':type/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get leaderboard statistics' })
  @ApiResponse({
    status: 200,
    description: 'Leaderboard statistics retrieved successfully',
    type: LeaderboardStatsResponseDto,
  })
  async getStats(
    @Param('type') type: LeaderboardType,
    @Query('period') period: LeaderboardPeriod = LeaderboardPeriod.WEEKLY,
  ): Promise<LeaderboardStatsResponseDto> {
    return this.leaderboardService.getLeaderboardStats(type, period);
  }

  @Get(':type/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get user's leaderboard history" })
  @ApiResponse({
    status: 200,
    description: 'User history retrieved successfully',
    type: [LeaderboardHistoryResponseDto],
  })
  async getHistory(
    @Param('type') type: LeaderboardType,
    @Query('limit') limit: number = 10,
    @CurrentUser() user: User,
  ): Promise<LeaderboardHistoryResponseDto[]> {
    return this.leaderboardService.getUserHistory(user.id, type, limit);
  }
}
