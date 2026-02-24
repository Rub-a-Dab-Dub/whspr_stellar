import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException } from '@nestjs/common';
import { AdminQuestService } from '../src/admin/services/admin-quest.service';
import { AuditLogService } from '../src/admin/services/audit-log.service';
import { Quest, QuestType, QuestStatus } from '../src/quest/entities/quest.entity';
import { UserQuestProgress } from '../src/quest/entities/user-quest-progress.entity';
import { User } from '../src/user/entities/user.entity';
import { UserBadge } from '../src/users/entities/user-badge.entity';

describe('Admin Quests (#233 integration)', () => {
  let service: AdminQuestService;
  let questRepository: any;
  let progressRepository: any;
  let userRepository: any;
  let userBadgeRepository: any;

  const mockQuest: Quest = {
    id: 'quest-id-123',
    title: 'Test Quest',
    description: 'A test quest',
    type: QuestType.REPEATABLE,
    status: QuestStatus.ACTIVE,
    xpReward: 100,
    badgeRewardId: null,
    condition: { action: 'send_message', count: 10 },
    requirementCount: 1,
    difficulty: 1,
    startDate: new Date(),
    endDate: new Date(Date.now() + 86400000),
    createdById: 'admin-id',
    createdBy: { id: 'admin-id' } as any,
    metadata: null,
    deletedAt: false,
    userProgress: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        AdminQuestService,
        {
          provide: getRepositoryToken(Quest),
          useValue: {
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserQuestProgress),
          useValue: {
            createQueryBuilder: jest.fn(),
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

    service = moduleFixture.get(AdminQuestService);
    questRepository = moduleFixture.get(getRepositoryToken(Quest));
    progressRepository = moduleFixture.get(getRepositoryToken(UserQuestProgress));
    userRepository = moduleFixture.get(getRepositoryToken(User));
    userBadgeRepository = moduleFixture.get(getRepositoryToken(UserBadge));
  });

  it('GET /admin/quests/:questId/completions shape', async () => {
    questRepository.findOne.mockResolvedValue(mockQuest);
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(1),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          userId: 'u1',
          username: 'alice',
          walletAddress: 'GABC',
          completedAt: new Date(),
        },
      ]),
    };
    progressRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getQuestCompletions(mockQuest.id, {
      page: 1,
      limit: 20,
      sortBy: 'completedAt',
      sortOrder: 'DESC',
    });

    expect(result.total).toBe(1);
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        userId: 'u1',
        username: 'alice',
        walletAddress: 'GABC',
        xpAwarded: 100,
        badgeAwarded: false,
      }),
    );
  });

  it('GET /admin/users/:userId/quests includes timesCompleted', async () => {
    userRepository.findOne.mockResolvedValue({ id: 'u1' });
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        {
          questId: 'q1',
          title: 'Repeat Quest',
          type: 'repeatable',
          xpAwarded: '100',
          completedAt: new Date(),
          timesCompleted: '3',
        },
      ]),
    };
    progressRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getUserQuestCompletions('u1');

    expect(result[0]).toEqual(
      expect.objectContaining({
        questId: 'q1',
        title: 'Repeat Quest',
        xpAwarded: 100,
        timesCompleted: 3,
      }),
    );
  });

  it('DELETE /admin/users/:userId/quests/:questId/completion deducts XP and recalculates level', async () => {
    questRepository.findOne.mockResolvedValue(mockQuest);
    userRepository.findOne.mockResolvedValue({
      id: 'u1',
      currentXp: 80,
      level: 1,
    });
    userRepository.save.mockImplementation(async (u: any) => u);
    progressRepository.findOne.mockResolvedValue({
      id: 'completion-1',
      userId: 'u1',
      questId: mockQuest.id,
      isCompleted: true,
    });
    progressRepository.remove.mockResolvedValue(undefined);

    userBadgeRepository.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    });

    const result = await service.revokeUserQuestCompletion(
      'u1',
      mockQuest.id,
      { reason: 'exploit' },
      'admin-1',
    );

    expect(result.success).toBe(true);
    expect(result.previousXp).toBe(80);
    expect(result.newXp).toBe(0);
    expect(result.previousLevel).toBe(1);
    expect(result.newLevel).toBe(1);
  });

  it('throws not found for unknown user on user quest history', async () => {
    userRepository.findOne.mockResolvedValue(null);
    await expect(service.getUserQuestCompletions('missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
