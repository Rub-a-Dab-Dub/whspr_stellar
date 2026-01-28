import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  UseGuards, 
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { QuestService } from './quest.service';
import { CreateQuestDto } from './dto/create-quest.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';

// Assuming you have these guards
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('quests')
export class QuestController {
  constructor(private readonly questService: QuestService) {}

  // Admin endpoints
  @Post('admin/create')
  // @UseGuards(JwtAuthGuard, AdminGuard)
  async createQuest(@Body() createQuestDto: CreateQuestDto) {
    return await this.questService.createQuest(createQuestDto);
  }

  @Get('admin/:questId/stats')
  // @UseGuards(JwtAuthGuard, AdminGuard)
  async getQuestStats(@Param('questId') questId: string) {
    return await this.questService.getQuestStats(questId);
  }

  // User endpoints
  @Get('active')
  // @UseGuards(JwtAuthGuard)
  async getActiveQuests() {
    return await this.questService.getActiveQuests();
  }

  @Get('my-progress')
  // @UseGuards(JwtAuthGuard)
  async getMyProgress(@Request() req) {
    const userId = req.user?.id || 'test-user'; // Replace with actual user ID from JWT
    return await this.questService.getUserQuestProgress(userId);
  }

  @Get('my-progress/:questId')
  // @UseGuards(JwtAuthGuard)
  async getMyQuestProgress(
    @Request() req,
    @Param('questId') questId: string,
  ) {
    const userId = req.user?.id || 'test-user';
    return await this.questService.getUserQuestProgress(userId, questId);
  }

  @Post('update-progress')
  // @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateProgress(
    @Request() req,
    @Body() updateProgressDto: UpdateProgressDto,
  ) {
    const userId = req.user?.id || 'test-user';
    return await this.questService.updateQuestProgress(
      userId,
      updateProgressDto.questId,
      updateProgressDto.progressIncrement,
    );
  }

  @Get('check-completion/:questId')
  // @UseGuards(JwtAuthGuard)
  async checkCompletion(
    @Request() req,
    @Param('questId') questId: string,
  ) {
    const userId = req.user?.id || 'test-user';
    const isCompleted = await this.questService.checkQuestCompletion(userId, questId);
    return { questId, isCompleted };
  }

  @Post('claim-reward/:questId')
  // @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async claimReward(
    @Request() req,
    @Param('questId') questId: string,
  ) {
    const userId = req.user?.id || 'test-user';
    return await this.questService.claimQuestReward(userId, questId);
  }
}