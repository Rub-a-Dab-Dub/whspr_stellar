import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AdminQuestService } from './admin-quest.service';
import { Quest, QuestStatus, QuestType } from '../../quest/entities/quest.entity';
import { UserQuestProgress } from '../../quest/entities/user-quest-progress.entity';
import { AuditLogService } from './audit-log.service';
import { CreateQuestDto } from '../dto/create-quest.dto';
import { UpdateQuestStatusDto } from '../dto/update-quest-status.dto';
import { User } from '../../user/entities/user.entity';
import { UserBadge } from '../../users/entities/user-badge.entity';

describe('AdminQuestService', () => {
  let service: AdminQuestService;
  let questRepository: any;
  let progressRepository: any;
  let userRepository: any;
  let userBadgeRepository: any;
  let auditLogService: any;
  let eventEmitter: any;

  const mockAdmin = {
    id: 'admin-id-123',
    email: 'admin@example.com',
  };

  const mockQuest: Quest = {
    id: 'quest-id-123',
    title: 'Test Quest',
    description: 'A test quest',
    type: QuestType.DAILY,
    status: QuestStatus.INACTIVE,
    xpReward: 100,
    badgeRewardId: null,
    condition: { action: 'send_message', count: 10 },
    requirementCount: 1,
    difficulty: 1,
    startDate: new Date(),
    endDate: new Date(Date.now() + 86400000),
    createdById: mockAdmin.id,
    createdBy: mockAdmin as any,
    metadata: null,
    deletedAt: false,
    userProgress: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminQuestService,
        {
          provide: getRepositoryToken(Quest),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
            countBy: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserQuestProgress),
          useValue: {
            createQueryBuilder: jest.fn(),
            countBy: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserBadge),
          useValue: {
            createQueryBuilder: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            createAuditLog: jest.fn(),
            log: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AdminQuestService>(AdminQuestService);
    questRepository = module.get(getRepositoryToken(Quest));
    progressRepository = module.get(getRepositoryToken(UserQuestProgress));
    userRepository = module.get(getRepositoryToken(User));
    userBadgeRepository = module.get(getRepositoryToken(UserBadge));
    auditLogService = module.get(AuditLogService);
    eventEmitter = module.get(EventEmitter2);
  });

  describe('createQuest', () => {
    it('should create a quest successfully', async () => {
      const createDto: CreateQuestDto = {
        title: 'New Quest',
        description: 'New quest description',
        type: QuestType.DAILY,
        xpReward: 150,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      };

      questRepository.create.mockReturnValue(mockQuest);
      questRepository.save.mockResolvedValue(mockQuest);
      auditLogService.createAuditLog.mockResolvedValue({});

      const result = await service.createQuest(createDto, mockAdmin.id);

      expect(result).toEqual(mockQuest);
      expect(questRepository.save).toHaveBeenCalled();
      expect(auditLogService.createAuditLog).toHaveBeenCalled();
    });

    it('should throw error if endDate is before startDate', async () => {
      const createDto: CreateQuestDto = {
        title: 'Invalid Quest',
        description: 'Invalid quest',
        type: QuestType.DAILY,
        xpReward: 100,
        startDate: new Date(Date.now() + 86400000).toISOString(),
        endDate: new Date().toISOString(),
      };

      await expect(
        service.createQuest(createDto, mockAdmin.id),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getQuestById', () => {
    it('should return quest with completion stats', async () => {
      questRepository.findOne.mockResolvedValue(mockQuest);

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(5),
        getRawOne: jest.fn().mockResolvedValue({ avgHours: '2.5' }),
        select: jest.fn().mockReturnThis(),
      };

      questRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      progressRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getQuestById('quest-id-123', mockAdmin.id);

      expect(result).toHaveProperty('completionStats');
      expect(result.completionStats).toHaveProperty('totalCompletions');
      expect(result.completionStats).toHaveProperty('uniqueUsers');
      expect(result.completionStats).toHaveProperty('avgCompletionTimeHours');
    });

    it('should throw NotFoundException if quest not found', async () => {
      questRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getQuestById('invalid-quest-id', mockAdmin.id),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateQuestStatus', () => {
    it('should update quest status successfully', async () => {
      questRepository.findOne.mockResolvedValue(mockQuest);
      questRepository.save.mockResolvedValue({
        ...mockQuest,
        status: QuestStatus.ACTIVE,
      });
      auditLogService.createAuditLog.mockResolvedValue({});

      const statusDto: UpdateQuestStatusDto = {
        status: QuestStatus.ACTIVE,
        reason: 'Starting new quest',
      };

      const result = await service.updateQuestStatus(
        'quest-id-123',
        statusDto,
        mockAdmin.id,
      );

      expect(result.status).toEqual(QuestStatus.ACTIVE);
      expect(auditLogService.createAuditLog).toHaveBeenCalled();
    });

    it('should throw error when activating quest with past endDate', async () => {
      const pastQuest = {
        ...mockQuest,
        endDate: new Date(Date.now() - 86400000),
      };
      questRepository.findOne.mockResolvedValue(pastQuest);

      const statusDto: UpdateQuestStatusDto = {
        status: QuestStatus.ACTIVE,
        reason: 'Starting quest',
      };

      await expect(
        service.updateQuestStatus('quest-id-123', statusDto, mockAdmin.id),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteQuest', () => {
    it('should soft delete quest with no completions', async () => {
      questRepository.findOne.mockResolvedValue(mockQuest);
      progressRepository.countBy.mockResolvedValue(0);
      questRepository.save.mockResolvedValue({ ...mockQuest, deletedAt: true });
      auditLogService.createAuditLog.mockResolvedValue({});

      await service.deleteQuest('quest-id-123', mockAdmin.id);

      expect(questRepository.save).toHaveBeenCalled();
      expect(auditLogService.createAuditLog).toHaveBeenCalled();
    });

    it('should throw ConflictException if quest has completions', async () => {
      questRepository.findOne.mockResolvedValue(mockQuest);
      progressRepository.countBy.mockResolvedValue(5);

      await expect(
        service.deleteQuest('quest-id-123', mockAdmin.id),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if quest not found', async () => {
      questRepository.findOne.mockResolvedValue(null);

      await expect(
        service.deleteQuest('invalid-quest-id', mockAdmin.id),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('revokeUserQuestCompletion', () => {
    beforeEach(() => {
      userBadgeRepository.createQueryBuilder.mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });
    });

    it('deducts XP down to 0 and keeps level at 1', async () => {
      questRepository.findOne.mockResolvedValue({ ...mockQuest, xpReward: 100, badgeRewardId: null });
      userRepository.findOne.mockResolvedValue({
        id: 'user-1',
        currentXp: 80,
        level: 1,
      });
      userRepository.save.mockImplementation(async (u) => u);
      progressRepository.findOne.mockResolvedValue({
        id: 'completion-1',
        userId: 'user-1',
        questId: mockQuest.id,
        isCompleted: true,
      });
      progressRepository.remove.mockResolvedValue(undefined);
      auditLogService.log.mockResolvedValue({});

      const result = await service.revokeUserQuestCompletion(
        'user-1',
        mockQuest.id,
        { reason: 'exploit' },
        mockAdmin.id,
      );

      expect(result.newXp).toBe(0);
      expect(result.newLevel).toBe(1);
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ currentXp: 0, level: 1 }),
      );
      expect(eventEmitter.emit).toHaveBeenCalled();
    });

    it('drops level when XP crosses threshold', async () => {
      questRepository.findOne.mockResolvedValue({ ...mockQuest, xpReward: 200, badgeRewardId: null });
      userRepository.findOne.mockResolvedValue({
        id: 'user-2',
        currentXp: 2050,
        level: 3,
      });
      userRepository.save.mockImplementation(async (u) => u);
      progressRepository.findOne.mockResolvedValue({
        id: 'completion-2',
        userId: 'user-2',
        questId: mockQuest.id,
        isCompleted: true,
      });
      progressRepository.remove.mockResolvedValue(undefined);
      auditLogService.log.mockResolvedValue({});

      const result = await service.revokeUserQuestCompletion(
        'user-2',
        mockQuest.id,
        { reason: 'invalid completion' },
        mockAdmin.id,
      );

      expect(result.previousLevel).toBe(3);
      expect(result.newLevel).toBe(2);
      expect(result.previousXp).toBe(2050);
      expect(result.newXp).toBe(1850);
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: expect.objectContaining({
            previousXp: 2050,
            newXp: 1850,
            reason: 'invalid completion',
          }),
        }),
      );
    });
  });
});
