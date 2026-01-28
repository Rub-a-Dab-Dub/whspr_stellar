import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestService } from './quest.service';
import { Quest, QuestType, RewardType } from './entities/quest.entity';
import { UserQuestProgress } from './entities/user-quest-progress.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('QuestService', () => {
  let service: QuestService;
  let questRepository: Repository<Quest>;
  let progressRepository: Repository<UserQuestProgress>;

  const mockQuestRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockProgressRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestService,
        {
          provide: getRepositoryToken(Quest),
          useValue: mockQuestRepository,
        },
        {
          provide: getRepositoryToken(UserQuestProgress),
          useValue: mockProgressRepository,
        },
      ],
    }).compile();

    service = module.get<QuestService>(QuestService);
    questRepository = module.get<Repository<Quest>>(getRepositoryToken(Quest));
    progressRepository = module.get<Repository<UserQuestProgress>>(
      getRepositoryToken(UserQuestProgress),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createQuest', () => {
    it('should create a quest successfully', async () => {
      const createQuestDto = {
        description: 'Test Quest',
        requirement: 'test_action',
        requirementCount: 5,
        questType: QuestType.DAILY,
        rewardType: RewardType.XP,
        rewardAmount: 100,
        activeUntil: new Date().toISOString(),
      };

      const expectedQuest = { id: '1', ...createQuestDto };
      mockQuestRepository.create.mockReturnValue(expectedQuest);
      mockQuestRepository.save.mockResolvedValue(expectedQuest);

      const result = await service.createQuest(createQuestDto);

      expect(result).toEqual(expectedQuest);
      expect(mockQuestRepository.create).toHaveBeenCalled();
      expect(mockQuestRepository.save).toHaveBeenCalled();
    });
  });

  describe('updateQuestProgress', () => {
    it('should update progress and mark as completed', async () => {
      const userId = 'user-1';
      const questId = 'quest-1';
      const quest = {
        id: questId,
        requirementCount: 5,
        activeUntil: new Date(Date.now() + 86400000),
        isActive: true,
      };

      const progress = {
        userId,
        questId,
        currentProgress: 3,
        isCompleted: false,
        isClaimed: false,
      };

      mockQuestRepository.findOne.mockResolvedValue(quest);
      mockProgressRepository.findOne.mockResolvedValue(progress);
      mockProgressRepository.save.mockResolvedValue({
        ...progress,
        currentProgress: 5,
        isCompleted: true,
        completedAt: expect.any(Date),
      });

      const result = await service.updateQuestProgress(userId, questId, 2);

      expect(result.currentProgress).toBe(5);
      expect(result.isCompleted).toBe(true);
      expect(mockProgressRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if quest not found', async () => {
      mockQuestRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateQuestProgress('user-1', 'invalid-quest', 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if quest expired', async () => {
      const quest = {
        id: 'quest-1',
        activeUntil: new Date(Date.now() - 86400000),
        isActive: true,
      };

      mockQuestRepository.findOne.mockResolvedValue(quest);

      await expect(
        service.updateQuestProgress('user-1', 'quest-1', 1),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('claimQuestReward', () => {
    it('should claim reward successfully', async () => {
      const userId = 'user-1';
      const questId = 'quest-1';

      const progress = {
        userId,
        questId,
        currentProgress: 5,
        isCompleted: true,
        isClaimed: false,
        quest: {
          id: questId,
          rewardType: RewardType.XP,
          rewardAmount: 100,
          activeUntil: new Date(Date.now() + 86400000),
        },
      };

      mockProgressRepository.findOne.mockResolvedValue(progress);
      mockProgressRepository.save.mockResolvedValue({
        ...progress,
        isClaimed: true,
        claimedAt: expect.any(Date),
      });

      const result = await service.claimQuestReward(userId, questId);

      expect(result.success).toBe(true);
      expect(result.xpGained).toBe(100);
      expect(mockProgressRepository.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if already claimed', async () => {
      const progress = {
        userId: 'user-1',
        questId: 'quest-1',
        isCompleted: true,
        isClaimed: true,
      };

      mockProgressRepository.findOne.mockResolvedValue(progress);

      await expect(
        service.claimQuestReward('user-1', 'quest-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if not completed', async () => {
      const progress = {
        userId: 'user-1',
        questId: 'quest-1',
        isCompleted: false,
        isClaimed: false,
      };

      mockProgressRepository.findOne.mockResolvedValue(progress);

      await expect(
        service.claimQuestReward('user-1', 'quest-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('checkQuestCompletion', () => {
    it('should return true if quest is completed', async () => {
      const progress = {
        currentProgress: 5,
        quest: { requirementCount: 5 },
      };

      mockProgressRepository.findOne.mockResolvedValue(progress);

      const result = await service.checkQuestCompletion('user-1', 'quest-1');

      expect(result).toBe(true);
    });

    it('should return false if quest is not completed', async () => {
      const progress = {
        currentProgress: 3,
        quest: { requirementCount: 5 },
      };

      mockProgressRepository.findOne.mockResolvedValue(progress);

      const result = await service.checkQuestCompletion('user-1', 'quest-1');

      expect(result).toBe(false);
    });

    it('should return false if no progress found', async () => {
      mockProgressRepository.findOne.mockResolvedValue(null);

      const result = await service.checkQuestCompletion('user-1', 'quest-1');

      expect(result).toBe(false);
    });
  });
});