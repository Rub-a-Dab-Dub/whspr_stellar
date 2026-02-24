import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { AdminController } from '../src/admin/controllers/admin.controller';
import { AdminQuestService } from '../src/admin/services/admin-quest.service';
import { AuditLogService } from '../src/admin/services/audit-log.service';
import { RoleGuard } from '../src/roles/guards/role.guard';
import { PermissionGuard } from '../src/roles/guards/permission.guard';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { Quest, QuestStatus, QuestType } from '../src/quest/entities/quest.entity';
import { UserQuestProgress } from '../src/quest/entities/user-quest-progress.entity';

describe('Admin Quests (e2e)', () => {
  let app: INestApplication;
  let adminQuestService: AdminQuestService;
  let questRepository: any;
  let jwtService: JwtService;

  const mockAdmin = {
    id: 'admin-id-123',
    email: 'admin@example.com',
    role: 'admin',
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

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminQuestService,
          useValue: {
            createQuest: jest.fn(),
            getQuests: jest.fn(),
            getQuestById: jest.fn(),
            updateQuest: jest.fn(),
            updateQuestStatus: jest.fn(),
            deleteQuest: jest.fn(),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            createAuditLog: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Quest),
          useValue: {},
        },
        {
          provide: getRepositoryToken(UserQuestProgress),
          useValue: {},
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('token'),
            verify: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RoleGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    adminQuestService = moduleFixture.get<AdminQuestService>(AdminQuestService);
    questRepository = moduleFixture.get(getRepositoryToken(Quest));
    jwtService = moduleFixture.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /admin/quests', () => {
    it('should create a quest', () => {
      const createDto = {
        title: 'New Quest',
        description: 'New quest description',
        type: QuestType.DAILY,
        xpReward: 150,
      };

      jest.spyOn(adminQuestService, 'createQuest').mockResolvedValue(mockQuest);

      return request(app.getHttpServer())
        .post('/admin/quests')
        .send(createDto)
        .set('Authorization', 'Bearer token')
        .expect(HttpStatus.CREATED);
    });

    it('should validate quest data', () => {
      const invalidDto = {
        title: 'New Quest',
        // missing required fields
      };

      return request(app.getHttpServer())
        .post('/admin/quests')
        .send(invalidDto)
        .set('Authorization', 'Bearer token')
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe('GET /admin/quests', () => {
    it('should return paginated quests list', () => {
      const mockResponse = {
        quests: [mockQuest],
        total: 1,
        page: 1,
        limit: 10,
      };

      jest
        .spyOn(adminQuestService, 'getQuests')
        .mockResolvedValue(mockResponse);

      return request(app.getHttpServer())
        .get('/admin/quests')
        .set('Authorization', 'Bearer token')
        .expect(HttpStatus.OK);
    });

    it('should filter quests by status', () => {
      const mockResponse = {
        quests: [],
        total: 0,
        page: 1,
        limit: 10,
      };

      jest
        .spyOn(adminQuestService, 'getQuests')
        .mockResolvedValue(mockResponse);

      return request(app.getHttpServer())
        .get('/admin/quests?status=active')
        .set('Authorization', 'Bearer token')
        .expect(HttpStatus.OK);
    });
  });

  describe('GET /admin/quests/:questId', () => {
    it('should return quest details with completion stats', () => {
      const mockResponse = {
        ...mockQuest,
        completionStats: {
          totalCompletions: 5,
          uniqueUsers: 3,
          completionRate: 60,
          avgCompletionTimeHours: 2.5,
        },
      };

      jest
        .spyOn(adminQuestService, 'getQuestById')
        .mockResolvedValue(mockResponse);

      return request(app.getHttpServer())
        .get(`/admin/quests/${mockQuest.id}`)
        .set('Authorization', 'Bearer token')
        .expect(HttpStatus.OK);
    });

    it('should return 404 if quest not found', () => {
      jest
        .spyOn(adminQuestService, 'getQuestById')
        .mockRejectedValue(new Error('Not Found'));

      return request(app.getHttpServer())
        .get('/admin/quests/invalid-id')
        .set('Authorization', 'Bearer token')
        .expect(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe('PATCH /admin/quests/:questId', () => {
    it('should update quest', () => {
      const updateDto = {
        title: 'Updated Quest',
        xpReward: 200,
      };

      const updatedQuest = {
        ...mockQuest,
        ...updateDto,
      };

      jest
        .spyOn(adminQuestService, 'updateQuest')
        .mockResolvedValue(updatedQuest);

      return request(app.getHttpServer())
        .patch(`/admin/quests/${mockQuest.id}`)
        .send(updateDto)
        .set('Authorization', 'Bearer token')
        .expect(HttpStatus.OK);
    });
  });

  describe('PATCH /admin/quests/:questId/status', () => {
    it('should update quest status', () => {
      const statusDto = {
        status: QuestStatus.ACTIVE,
        reason: 'Activating quest',
      };

      const updatedQuest = {
        ...mockQuest,
        status: QuestStatus.ACTIVE,
      };

      jest
        .spyOn(adminQuestService, 'updateQuestStatus')
        .mockResolvedValue(updatedQuest);

      return request(app.getHttpServer())
        .patch(`/admin/quests/${mockQuest.id}/status`)
        .send(statusDto)
        .set('Authorization', 'Bearer token')
        .expect(HttpStatus.OK);
    });

    it('should reject activating quest with past endDate', () => {
      const statusDto = {
        status: QuestStatus.ACTIVE,
        reason: 'Activating quest',
      };

      jest
        .spyOn(adminQuestService, 'updateQuestStatus')
        .mockRejectedValue(new Error('Bad Request'));

      return request(app.getHttpServer())
        .patch(`/admin/quests/${mockQuest.id}/status`)
        .send(statusDto)
        .set('Authorization', 'Bearer token')
        .expect(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe('DELETE /admin/quests/:questId', () => {
    it('should delete quest with no completions', () => {
      jest.spyOn(adminQuestService, 'deleteQuest').mockResolvedValue(undefined);

      return request(app.getHttpServer())
        .delete(`/admin/quests/${mockQuest.id}`)
        .set('Authorization', 'Bearer token')
        .expect(HttpStatus.NO_CONTENT);
    });

    it('should reject deleting quest with completions', () => {
      jest
        .spyOn(adminQuestService, 'deleteQuest')
        .mockRejectedValue(new Error('Conflict'));

      return request(app.getHttpServer())
        .delete(`/admin/quests/${mockQuest.id}`)
        .set('Authorization', 'Bearer token')
        .expect(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
