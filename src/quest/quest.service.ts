import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { Quest, QuestType, RewardType } from './entities/quest.entity';
import { UserQuestProgress } from './entities/user-quest-progress.entity';
import { CreateQuestDto } from './dto/create-quest.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class QuestService {
  private readonly logger = new Logger(QuestService.name);

  constructor(
    @InjectRepository(Quest)
    private questRepository: Repository<Quest>,
    @InjectRepository(UserQuestProgress)
    private progressRepository: Repository<UserQuestProgress>,
  ) {}

  // Admin function to create quests
  async createQuest(createQuestDto: CreateQuestDto): Promise<Quest> {
    const quest = this.questRepository.create({
      ...createQuestDto,
      activeUntil: new Date(createQuestDto.activeUntil),
    });

    return await this.questRepository.save(quest);
  }

  // Get all active quests
  async getActiveQuests(): Promise<Quest[]> {
    return await this.questRepository.find({
      where: {
        isActive: true,
        activeUntil: MoreThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });
  }

  // Get user's quest progress
  async getUserQuestProgress(
    userId: string,
    questId?: string,
  ): Promise<UserQuestProgress[]> {
    const where: any = { userId };
    if (questId) {
      where.questId = questId;
    }

    return await this.progressRepository.find({
      where,
      relations: ['quest'],
    });
  }

  // Update quest progress
  async updateQuestProgress(
    userId: string,
    questId: string,
    progressIncrement: number,
  ): Promise<UserQuestProgress> {
    const quest = await this.questRepository.findOne({
      where: { id: questId, isActive: true },
    });

    if (!quest) {
      throw new NotFoundException('Quest not found or inactive');
    }

    if (new Date() > quest.activeUntil) {
      throw new BadRequestException('Quest has expired');
    }

    let progress = await this.progressRepository.findOne({
      where: { userId, questId },
    });

    if (!progress) {
      progress = this.progressRepository.create({
        userId,
        questId,
        currentProgress: 0,
      });
    }

    if (progress.isClaimed) {
      throw new BadRequestException('Quest reward already claimed');
    }

    progress.currentProgress += progressIncrement;

    // Check completion
    if (
      progress.currentProgress >= quest.requirementCount &&
      !progress.isCompleted
    ) {
      progress.isCompleted = true;
      progress.completedAt = new Date();
    }

    return await this.progressRepository.save(progress);
  }

  // Check quest completion
  async checkQuestCompletion(
    userId: string,
    questId: string,
  ): Promise<boolean> {
    const progress = await this.progressRepository.findOne({
      where: { userId, questId },
      relations: ['quest'],
    });

    if (!progress) {
      return false;
    }

    return progress.currentProgress >= progress.quest.requirementCount;
  }

  // Claim quest reward
  async claimQuestReward(
    userId: string,
    questId: string,
  ): Promise<{
    success: boolean;
    rewardType: RewardType;
    rewardAmount: number;
    xpGained?: number;
    tokensGained?: number;
  }> {
    const progress = await this.progressRepository.findOne({
      where: { userId, questId },
      relations: ['quest'],
    });

    if (!progress) {
      throw new NotFoundException('Quest progress not found');
    }

    if (progress.isClaimed) {
      throw new BadRequestException('Reward already claimed');
    }

    if (!progress.isCompleted) {
      throw new BadRequestException('Quest not completed yet');
    }

    const quest = progress.quest;

    if (new Date() > quest.activeUntil) {
      throw new BadRequestException('Quest has expired');
    }

    // Mark as claimed
    progress.isClaimed = true;
    progress.claimedAt = new Date();
    await this.progressRepository.save(progress);

    // Calculate rewards
    const result: any = {
      success: true,
      rewardType: quest.rewardType,
      rewardAmount: quest.rewardAmount,
    };

    if (
      quest.rewardType === RewardType.XP ||
      quest.rewardType === RewardType.BOTH
    ) {
      result.xpGained = quest.rewardAmount;
      // Here you would call your user service to add XP
      // await this.userService.addXP(userId, quest.rewardAmount);
    }

    if (
      quest.rewardType === RewardType.TOKEN ||
      quest.rewardType === RewardType.BOTH
    ) {
      result.tokensGained = quest.rewardAmount;
      // Here you would call your token service to add tokens
      // await this.tokenService.addTokens(userId, quest.rewardAmount);
    }

    this.logger.log(`User ${userId} claimed reward for quest ${questId}`);

    return result;
  }

  // Reset daily quests - runs at midnight
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async resetDailyQuests() {
    this.logger.log('Resetting daily quests...');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // Deactivate expired daily quests
    await this.questRepository.update(
      {
        questType: QuestType.DAILY,
        activeUntil: LessThan(new Date()),
      },
      { isActive: false },
    );

    // Create new daily quests for today
    await this.createRecurringQuests(QuestType.DAILY);

    this.logger.log('Daily quests reset complete');
  }

  // Reset weekly quests - runs every Monday at midnight
  @Cron(CronExpression.EVERY_WEEK)
  async resetWeeklyQuests() {
    this.logger.log('Resetting weekly quests...');

    await this.questRepository.update(
      {
        questType: QuestType.WEEKLY,
        activeUntil: LessThan(new Date()),
      },
      { isActive: false },
    );

    await this.createRecurringQuests(QuestType.WEEKLY);

    this.logger.log('Weekly quests reset complete');
  }

  // Create recurring quests (you can customize this)
  private async createRecurringQuests(type: QuestType) {
    // Example: Create standard daily/weekly quests
    const templates = this.getQuestTemplates(type);

    for (const template of templates) {
      await this.createQuest(template);
    }
  }

  // Quest templates (customize based on your needs)
  private getQuestTemplates(type: QuestType): CreateQuestDto[] {
    const now = new Date();
    const activeUntil = new Date(now);

    if (type === QuestType.DAILY) {
      activeUntil.setDate(activeUntil.getDate() + 1);
      return [
        {
          description: 'Complete 5 tasks',
          requirement: 'task_completion',
          requirementCount: 5,
          questType: QuestType.DAILY,
          rewardType: RewardType.XP,
          rewardAmount: 100,
          activeUntil: activeUntil.toISOString(),
        },
        {
          description: 'Log in for the day',
          requirement: 'daily_login',
          requirementCount: 1,
          questType: QuestType.DAILY,
          rewardType: RewardType.TOKEN,
          rewardAmount: 10,
          activeUntil: activeUntil.toISOString(),
        },
      ];
    } else if (type === QuestType.WEEKLY) {
      activeUntil.setDate(activeUntil.getDate() + 7);
      return [
        {
          description: 'Complete 25 tasks this week',
          requirement: 'task_completion',
          requirementCount: 25,
          questType: QuestType.WEEKLY,
          rewardType: RewardType.BOTH,
          rewardAmount: 500,
          activeUntil: activeUntil.toISOString(),
        },
      ];
    }

    return [];
  }

  // Cleanup expired quests and progress
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredQuests() {
    this.logger.log('Cleaning up expired quests...');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Delete old progress records
    await this.progressRepository.delete({
      createdAt: LessThan(thirtyDaysAgo),
      isClaimed: true,
    });

    this.logger.log('Cleanup complete');
  }

  // Get quest statistics for admin
  async getQuestStats(questId: string) {
    const quest = await this.questRepository.findOne({
      where: { id: questId },
    });

    if (!quest) {
      throw new NotFoundException('Quest not found');
    }

    const totalUsers = await this.progressRepository.count({
      where: { questId },
    });
    const completedUsers = await this.progressRepository.count({
      where: { questId, isCompleted: true },
    });
    const claimedUsers = await this.progressRepository.count({
      where: { questId, isClaimed: true },
    });

    return {
      quest,
      totalUsers,
      completedUsers,
      claimedUsers,
      completionRate: totalUsers > 0 ? (completedUsers / totalUsers) * 100 : 0,
      claimRate: completedUsers > 0 ? (claimedUsers / completedUsers) * 100 : 0,
    };
  }
}
