import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { ReputationModule } from '../reputation.module';
import { ReputationService } from '../reputation.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

const mockRepService = {
  rateUser: jest.fn(),
  getReputation: jest.fn(),
  flagUser: jest.fn(),
  getFlags: jest.fn(),
  syncFromChain: jest.fn(),
};

// Bypass JWT for e2e tests; inject a synthetic user.
class MockJwtGuard {
  canActivate(ctx: any) {
    const req = ctx.switchToHttp().getRequest();
    req.user = { id: 'test-user-id' };
    return true;
  }
}

describe('Reputation (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ReputationModule],
    })
      .overrideProvider(ReputationService)
      .useValue(mockRepService)
      .overrideGuard(JwtAuthGuard)
      .useClass(MockJwtGuard)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => jest.clearAllMocks());

  // ── POST /users/:id/rate ──────────────────────────────────────────────────

  describe('POST /users/:id/rate', () => {
    it('returns 201 on valid payload', async () => {
      mockRepService.rateUser.mockResolvedValue({
        id: 'r-1',
        raterId: 'test-user-id',
        ratedUserId: 'target-id',
        conversationId: '00000000-0000-0000-0000-000000000001',
        score: 4,
        comment: 'Great!',
        createdAt: new Date().toISOString(),
      });

      await request(app.getHttpServer())
        .post('/users/00000000-0000-0000-0000-000000000002/rate')
        .send({
          conversationId: '00000000-0000-0000-0000-000000000001',
          score: 4,
          comment: 'Great!',
        })
        .expect(201);
    });

    it('returns 400 when score is out of range', async () => {
      await request(app.getHttpServer())
        .post('/users/00000000-0000-0000-0000-000000000002/rate')
        .send({
          conversationId: '00000000-0000-0000-0000-000000000001',
          score: 6,
        })
        .expect(400);
    });

    it('returns 400 when comment exceeds 280 chars', async () => {
      await request(app.getHttpServer())
        .post('/users/00000000-0000-0000-0000-000000000002/rate')
        .send({
          conversationId: '00000000-0000-0000-0000-000000000001',
          score: 3,
          comment: 'a'.repeat(281),
        })
        .expect(400);
    });

    it('returns 400 when conversationId is not a UUID', async () => {
      await request(app.getHttpServer())
        .post('/users/00000000-0000-0000-0000-000000000002/rate')
        .send({ conversationId: 'not-a-uuid', score: 3 })
        .expect(400);
    });
  });

  // ── GET /users/:id/reputation ─────────────────────────────────────────────

  describe('GET /users/:id/reputation', () => {
    it('returns 200 with reputation data', async () => {
      mockRepService.getReputation.mockResolvedValue({
        userId: '00000000-0000-0000-0000-000000000002',
        score: 4.2,
        totalRatings: 5,
        positiveRatings: 4,
        flags: 0,
        isUnderReview: false,
        onChainScore: null,
        lastChainSyncAt: null,
        lastUpdatedAt: new Date().toISOString(),
      });

      const res = await request(app.getHttpServer())
        .get('/users/00000000-0000-0000-0000-000000000002/reputation')
        .expect(200);

      expect(res.body.score).toBe(4.2);
      expect(res.body.totalRatings).toBe(5);
    });

    it('returns 400 for non-UUID param', async () => {
      await request(app.getHttpServer()).get('/users/not-a-uuid/reputation').expect(400);
    });
  });

  // ── POST /users/:id/flag ──────────────────────────────────────────────────

  describe('POST /users/:id/flag', () => {
    it('returns 200 on valid flag', async () => {
      mockRepService.flagUser.mockResolvedValue({
        userId: '00000000-0000-0000-0000-000000000002',
        flags: 1,
        isUnderReview: false,
      });

      await request(app.getHttpServer())
        .post('/users/00000000-0000-0000-0000-000000000002/flag')
        .send({ reason: 'Repeated spam in messages' })
        .expect(200);
    });

    it('returns 400 when reason is too short', async () => {
      await request(app.getHttpServer())
        .post('/users/00000000-0000-0000-0000-000000000002/flag')
        .send({ reason: 'bad' })
        .expect(400);
    });

    it('returns 200 and isUnderReview true at threshold', async () => {
      mockRepService.flagUser.mockResolvedValue({
        userId: '00000000-0000-0000-0000-000000000002',
        flags: 3,
        isUnderReview: true,
      });

      const res = await request(app.getHttpServer())
        .post('/users/00000000-0000-0000-0000-000000000002/flag')
        .send({ reason: 'Third time flagging for abuse' })
        .expect(200);

      expect(res.body.isUnderReview).toBe(true);
    });
  });
});
