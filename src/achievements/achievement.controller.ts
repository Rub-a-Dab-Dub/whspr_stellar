import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AchievementService } from '../services/achievement.service';
import {
  CreateAchievementDto,
  UpdateAchievementDto,
  AchievementResponseDto,
  UserAchievementResponseDto,
} from '../dto/achievement.dto';

// You would replace this with your actual auth guard
// import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('achievements')
@Controller('achievements')
export class AchievementController {
  constructor(private readonly achievementService: AchievementService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new achievement (admin only)' })
  @ApiResponse({ status: 201, description: 'Achievement created successfully' })
  // @UseGuards(JwtAuthGuard, AdminGuard)
  async create(@Body() createDto: CreateAchievementDto) {
    return this.achievementService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all achievements (public listing)' })
  @ApiResponse({ status: 200, description: 'List of all achievements' })
  async findAll(@Query('includeHidden') includeHidden?: string) {
    const include = includeHidden === 'true';
    return this.achievementService.findAll(include);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get achievement statistics' })
  @ApiResponse({ status: 200, description: 'Achievement statistics' })
  async getStats() {
    return {
      recentlyUnlocked: await this.achievementService.getRecentlyUnlocked(10),
      rarest: await this.achievementService.getRarestAchievements(5),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single achievement by ID' })
  @ApiResponse({ status: 200, description: 'Achievement found' })
  @ApiResponse({ status: 404, description: 'Achievement not found' })
  async findOne(@Param('id') id: string) {
    return this.achievementService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an achievement (admin only)' })
  @ApiResponse({ status: 200, description: 'Achievement updated successfully' })
  // @UseGuards(JwtAuthGuard, AdminGuard)
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAchievementDto,
  ) {
    return this.achievementService.update(id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an achievement (admin only)' })
  @ApiResponse({ status: 204, description: 'Achievement deleted successfully' })
  // @UseGuards(JwtAuthGuard, AdminGuard)
  async remove(@Param('id') id: string) {
    await this.achievementService.remove(id);
  }
}

@ApiTags('users')
@Controller('users')
export class UserAchievementController {
  constructor(private readonly achievementService: AchievementService) {}

  @Get('me/achievements')
  @ApiOperation({ summary: 'Get current user achievements' })
  @ApiResponse({ status: 200, description: 'List of user achievements' })
  @ApiBearerAuth()
  // @UseGuards(JwtAuthGuard)
  async getMyAchievements(@Request() req) {
    // Extract user ID from authenticated request
    const userId = req.user?.id || 'demo-user-id'; // Replace with actual user ID extraction

    return this.achievementService.getUserAchievements(userId);
  }

  @Get('me/achievements/progress')
  @ApiOperation({ summary: 'Get current user achievement progress' })
  @ApiResponse({ status: 200, description: 'Achievement progress' })
  @ApiBearerAuth()
  // @UseGuards(JwtAuthGuard)
  async getMyAchievementProgress(@Request() req) {
    const userId = req.user?.id || 'demo-user-id';

    return this.achievementService.getUserAchievementProgress(userId);
  }

  @Get('me/achievements/stats')
  @ApiOperation({ summary: 'Get current user achievement statistics' })
  @ApiResponse({ status: 200, description: 'Achievement statistics' })
  @ApiBearerAuth()
  // @UseGuards(JwtAuthGuard)
  async getMyAchievementStats(@Request() req) {
    const userId = req.user?.id || 'demo-user-id';

    return this.achievementService.getUserAchievementStats(userId);
  }

  @Get('me/achievements/unlocked')
  @ApiOperation({ summary: 'Get current user unlocked achievements only' })
  @ApiResponse({ status: 200, description: 'List of unlocked achievements' })
  @ApiBearerAuth()
  // @UseGuards(JwtAuthGuard)
  async getMyUnlockedAchievements(@Request() req) {
    const userId = req.user?.id || 'demo-user-id';

    return this.achievementService.getUserUnlockedAchievements(userId);
  }

  @Post('me/achievements/:achievementId/unlock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually unlock an achievement for current user (admin only)',
  })
  @ApiResponse({ status: 200, description: 'Achievement unlocked' })
  @ApiBearerAuth()
  // @UseGuards(JwtAuthGuard, AdminGuard)
  async unlockAchievement(
    @Request() req,
    @Param('achievementId') achievementId: string,
  ) {
    const userId = req.user?.id || 'demo-user-id';

    return this.achievementService.unlockAchievement(userId, achievementId);
  }

  @Get(':userId/achievements')
  @ApiOperation({ summary: 'Get achievements for a specific user' })
  @ApiResponse({ status: 200, description: 'List of user achievements' })
  async getUserAchievements(@Param('userId') userId: string) {
    return this.achievementService.getUserAchievements(userId);
  }

  @Get(':userId/achievements/stats')
  @ApiOperation({ summary: 'Get achievement statistics for a specific user' })
  @ApiResponse({ status: 200, description: 'Achievement statistics' })
  async getUserAchievementStats(@Param('userId') userId: string) {
    return this.achievementService.getUserAchievementStats(userId);
  }
}
