import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import { XpHistoryQueryDto } from './dto/xp-history-query.dto';
import { AddXpDto } from './dto/add-xp.dto';
import { XpService } from './services/xp.service';
import { StreakService } from './services/streak.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/guards/jwt-refresh-auth.guard';
import { UpdateChainPreferenceDto } from '../chain/dto/update-chain-preference.dto';
import { UserStatsService } from './services/user-stats.service';
import { UserStatsQueryDto } from './dto/user-stats-query.dto';
import { UserStatsExportQueryDto } from './dto/user-stats-export-query.dto';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly xpService: XpService,
    private readonly streakService: StreakService,
    private readonly userStatsService: UserStatsService,
  ) { }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get('search')
  search(@Query() searchDto: SearchUsersDto) {
    return this.usersService.findAll(searchDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/stats')
  getMyStats(@CurrentUser() user: any, @Query() query: UserStatsQueryDto) {
    const includeComparison = query.includeComparison !== 'false';
    return this.userStatsService.getStatsForUser(user.userId, includeComparison);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/stats/export')
  exportMyStats(
    @CurrentUser() user: any,
    @Query() query: UserStatsExportQueryDto,
  ) {
    return this.userStatsService.exportStats(user.userId, query.format || 'json');
  }

  @Get(':id/stats')
  getUserStats(@Param('id') id: string, @Query() query: UserStatsQueryDto) {
    const includeComparison = query.includeComparison !== 'false';
    return this.userStatsService.getStatsForUser(id, includeComparison);
  }

  @Get(':id/stats/export')
  exportUserStats(@Param('id') id: string, @Query() query: UserStatsExportQueryDto) {
    return this.userStatsService.exportStats(id, query.format || 'json');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Get('username/:username')
  findByUsername(@Param('username') username: string) {
    return this.usersService.findByUsername(username);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  uploadAvatar(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.usersService.uploadAvatar(id, file);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  deactivate(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Post(':id/xp')
  @HttpCode(HttpStatus.OK)
  addXp(@Param('id') id: string, @Body() addXpDto: AddXpDto) {
    return this.xpService.addXp(id, addXpDto.action, addXpDto.description);
  }

  @Get(':id/xp')
  getUserXpStats(@Param('id') id: string) {
    return this.xpService.getUserXpStats(id);
  }

  @Get(':id/xp/history')
  getUserXpHistory(
    @Param('id') id: string,
    @Query() query: XpHistoryQueryDto,
  ) {
    return this.xpService.getXpHistory(id, query.page, query.limit);
  }

  @Get('leaderboard/top')
  getLeaderboard(@Query() query: LeaderboardQueryDto) {
    return this.xpService.getLeaderboard(query.page, query.limit);
  }

  @Get('analytics/xp')
  getXpAnalytics() {
    return Promise.all([
      this.xpService.getTotalXp(),
      this.xpService.getAverageXpPerUser(),
      this.xpService.getWeeklyXp(),
      this.xpService.getXpByAction(),
    ]).then(([total, average, weekly, byAction]) => ({
      totalXp: total,
      averageXpPerUser: average,
      weekly,
      byAction,
    }));
  }

  // Streak endpoints
  @UseGuards(JwtAuthGuard)
  @Get('me/streak')
  getMyStreak(@CurrentUser() user: any) {
    return this.streakService.getUserStreak(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/streak/track-login')
  @HttpCode(HttpStatus.OK)
  trackDailyLogin(@CurrentUser() user: any) {
    return this.streakService.trackDailyLogin(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/streak/use-freeze')
  @HttpCode(HttpStatus.OK)
  useFreezeItem(@CurrentUser() user: any) {
    return this.streakService.useFreezeItem(user.userId);
  }

  @Get('streak/leaderboard')
  getStreakLeaderboard(@Query() query: LeaderboardQueryDto) {
    return this.streakService.getStreakLeaderboard(query.page, query.limit);
  }

  @Get('analytics/streak')
  getStreakAnalytics() {
    return this.streakService.getStreakAnalytics();
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/chain-preference')
  updateChainPreference(
    @CurrentUser() user: any,
    @Body() dto: UpdateChainPreferenceDto,
  ) {
    return this.usersService.update(user.userId, {
      preferredChain: dto.preferredChain,
    } as any);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/chain-preference')
  async getChainPreference(@CurrentUser() user: any) {
    const userEntity = await this.usersService.findOne(user.userId);
    return { preferredChain: userEntity.preferredChain || null };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/streak/history')
  getMyStreakHistory(
    @CurrentUser() user: any,
    @Query() query: XpHistoryQueryDto,
  ) {
    return this.streakService.getStreakHistory(user.userId, query.page, query.limit);
  }
}
