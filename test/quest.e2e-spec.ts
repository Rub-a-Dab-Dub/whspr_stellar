import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { QuestController } from '../src/quest/quest.controller';
import { QuestService } from '../src/quest/quest.service';
import { QuestType, RewardType, QuestStatus } from '../src/quest/entities/quest.entity';

const USER_ID = 'user-uuid';
const QUEST_ID = 'quest-uuid';

const mockQuest = {
    id: QUEST_ID,
    title: 'Test Quest',
    description: 'Test Description',
    type: QuestType.DAILY,
    status: QuestStatus.ACTIVE,
    xpReward: 100,
    requirement: 'SEND_MESSAGES',
    requirementCount: 5,
    difficulty: 1,
    activeUntil: new Date(Date.now() + 86400000),
};

describe('Quest System - API (e2e)', () => {
    let app: INestApplication;
    let questService: Partial<jest.Mocked<QuestService>>;

    const mockQuestService = {
        getActiveQuests: jest.fn(),
        getUserQuestProgress: jest.fn(),
        updateQuestProgress: jest.fn(),
        checkQuestCompletion: jest.fn(),
        claimQuestReward: jest.fn(),
        createQuest: jest.fn(),
        getQuestStats: jest.fn(),
    };

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            controllers: [QuestController],
            providers: [
                { provide: QuestService, useValue: mockQuestService },
            ],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({
                canActivate: (ctx: any) => {
                    const req = ctx.switchToHttp().getRequest();
                    req.user = { id: USER_ID, sub: USER_ID };
                    return true;
                },
            })
            .compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ transform: true }));
        await app.init();

        questService = moduleFixture.get<QuestService>(QuestService) as any;
    });

    afterAll(async () => {
        await app.close();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /quests', () => {
        it('should return available quests (200)', async () => {
            mockQuestService.getActiveQuests.mockResolvedValue([mockQuest]);

            const res = await request(app.getHttpServer())
                .get('/quests')
                .expect(HttpStatus.OK);

            expect(res.body).toBeInstanceOf(Array);
            expect(res.body[0].id).toBe(QUEST_ID);
            expect(mockQuestService.getActiveQuests).toHaveBeenCalledWith(USER_ID);
        });
    });

    describe('GET /quests/active', () => {
        it('should return user active quests progress (200)', async () => {
            mockQuestService.getUserQuestProgress.mockResolvedValue([]);

            const res = await request(app.getHttpServer())
                .get('/quests/active')
                .expect(HttpStatus.OK);

            expect(res.body).toBeInstanceOf(Array);
            expect(mockQuestService.getUserQuestProgress).toHaveBeenCalledWith(USER_ID);
        });
    });

    describe('POST /quests/claim-reward/:questId', () => {
        it('should claim quest reward (200)', async () => {
            mockQuestService.claimQuestReward.mockResolvedValue({
                success: true,
                rewardType: RewardType.XP,
                xpGained: 100,
            });

            const res = await request(app.getHttpServer())
                .post(`/quests/claim-reward/${QUEST_ID}`)
                .expect(HttpStatus.OK);

            expect(res.body.success).toBe(true);
            expect(res.body.xpGained).toBe(100);
            expect(mockQuestService.claimQuestReward).toHaveBeenCalledWith(USER_ID, QUEST_ID);
        });
    });
});
