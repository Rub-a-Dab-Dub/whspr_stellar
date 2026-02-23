import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { Quest, QuestType, RewardType, QuestStatus } from './entities/quest.entity';
import { UserQuestProgress } from './entities/user-quest-progress.entity';
import { CreateQuestDto } from './dto/create-quest.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UsersService } from '../user/user.service';
import { TransferService } from '../transfer/transfer.service';

@Injectable()
export class QuestService {
  private readonly logger = new Logger(QuestService.name);

  constructor(
    @InjectRepository(Quest)
    private questRepository: Repository<Quest>,
    @InjectRepository(UserQuestProgress)
    private progressRepository: Repository<UserQuestProgress>,
    private readonly usersService: UsersService,
    private readonly transferService: TransferService,
  ) {
    // Optional: Auto-seed on startup in dev environment
    if (process.env.NODE_ENV === 'development') {
      this.seedQuests();
    }
  }

  async seedQuests(): Promise<void> {
    const dailyTemplates = this.getQuestTemplates(QuestType.DAILY);
    const weeklyTemplates = this.getQuestTemplates(QuestType.WEEKLY);
    const seasonalTemplates = this.getQuestTemplates(QuestType.SEASONAL);

    const allTemplates = [...dailyTemplates, ...weeklyTemplates, ...seasonalTemplates];

    for (const template of allTemplates) {
      const existing = await this.questRepository.findOne({
        where: { title: template.title, type: template.type }
      });

      if (!existing) {
        await this.createQuest(template);
      }
    }

    this.logger.log('Quest seeding complete');
  }

  // Admin function to create quests
  async createQuest(createQuestDto: CreateQuestDto): Promise<Quest> {
    const quest = this.questRepository.create({
      ...createQuestDto,
      activeUntil: new Date(createQuestDto.activeUntil),
    });

    return await this.questRepository.save(quest);
  }

  // Get all active quests available for a user
  async getActiveQuests(userId: string): Promise<Quest[]> {
    const allActiveQuests = await this.questRepository.find({
      where: {
        status: QuestStatus.ACTIVE,
        activeUntil: MoreThan(new Date()),
      },
      order: { difficulty: 'ASC', createdAt: 'DESC' },
    });

    // Filter by quest chains
    const userProgress = await this.progressRepository.find({
      where: { userId, isCompleted: true },
      select: ['questId'],
    });
    const completedQuestIds = new Set(userProgress.map((p) => p.questId));

    return allActiveQuests.filter((quest) => {
      if (!quest.requiredQuestId) return true;
      return completedQuestIds.has(quest.requiredQuestId);
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
      rewardAmount: quest.rewardAmount || quest.xpReward, // Handle both naming conventions
    };

    const rewardValue = quest.rewardAmount || quest.xpReward;

    if (
      quest.rewardType === RewardType.XP ||
      quest.rewardType === RewardType.BOTH
    ) {
      result.xpGained = rewardValue;
      // Actual user service call to add XP
      await this.usersService.addXp(userId, rewardValue);
    }

    if (
      quest.rewardType === RewardType.TOKEN ||
      quest.rewardType === RewardType.BOTH
    ) {
      result.tokensGained = rewardValue;
      // Actual transfer service call to reward tokens (from system wallet)
      // This assumes a system user/wallet exists for rewards
      const SYSTEM_USER_ID = this.usersService.getSystemUserId();
      if (SYSTEM_USER_ID) {
        await this.transferService.createTransfer(SYSTEM_USER_ID, {
          recipientId: userId,
          amount: rewardValue,
          memo: `Quest Reward: ${quest.title}`,
          blockchainNetwork: 'stellar',
        });
      }
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

  // Reset seasonal quests - runs every month
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async resetSeasonalQuests() {
    this.logger.log('Resetting seasonal quests...');

    await this.questRepository.update(
      {
        type: QuestType.SEASONAL,
        activeUntil: LessThan(new Date()),
      },
      { status: QuestStatus.INACTIVE },
    );

    await this.createRecurringQuests(QuestType.SEASONAL);

    this.logger.log('Seasonal quests reset complete');
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
          title: 'Daily Messenger',
          description: 'Send 5 messages in any room',
          requirement: 'SEND_MESSAGES',
          requirementCount: 5,
          type: QuestType.DAILY,
          rewardType: RewardType.XP,
          xpReward: 100,
          activeUntil: activeUntil.toISOString(),
          difficulty: 1,
        },
        {
          title: 'Daily Tipper',
          description: 'Tip 3 different users',
          requirement: 'TIP_USERS',
          requirementCount: 3,
          type: QuestType.DAILY,
          rewardType: RewardType.TOKEN,
          rewardAmount: 5,
          activeUntil: activeUntil.toISOString(),
          difficulty: 2,
        },
      ];
    } else if (type === QuestType.WEEKLY) {
      activeUntil.setDate(activeUntil.getDate() + 7);
      return [
        {
          title: 'Room Architect',
          description: 'Create 10 new rooms this week',
          requirement: 'CREATE_ROOM',
          requirementCount: 10,
          type: QuestType.WEEKLY,
          rewardType: RewardType.BOTH,
          xpReward: 500,
          rewardAmount: 50,
          activeUntil: activeUntil.toISOString(),
          difficulty: 3,
        },
      ];
    } else if (type === QuestType.SEASONAL) {
      activeUntil.setMonth(activeUntil.getMonth() + 1);
      return [
        {
          title: 'Season Pioneer',
          description: 'Be active throughout the season',
          requirement: 'seasonal_activity',
          requirementCount: 30,
          type: QuestType.SEASONAL,
          rewardType: RewardType.BOTH,
          xpReward: 5000,
          rewardAmount: 100,
          activeUntil: activeUntil.toISOString(),
          difficulty: 5,
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
