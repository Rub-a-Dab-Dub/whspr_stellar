import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ReputationService } from '../reputation.service';
import { ReputationRepository } from '../reputation.repository';
import { ReputationScore } from '../entities/reputation-score.entity';
import { UserRating } from '../entities/user-rating.entity';

const makeScore = (overrides: Partial<ReputationScore> = {}): ReputationScore =>
  Object.assign(new ReputationScore(), {
    id: 'score-1',
    userId: 'user-b',
    score: 0,
    totalRatings: 0,
    positiveRatings: 0,
    flags: 0,
    isUnderReview: false,
    onChainScore: null,
    lastChainSyncAt: null,
    createdAt: new Date(),
    lastUpdatedAt: new Date(),
    ...overrides,
  });

const makeRating = (overrides: Partial<UserRating> = {}): UserRating =>
  Object.assign(new UserRating(), {
    id: 'rating-1',
    raterId: 'user-a',
    ratedUserId: 'user-b',
    conversationId: 'conv-1',
    score: 4,
    comment: null,
    createdAt: new Date(),
    ...overrides,
  });

describe('ReputationService', () => {
  let service: ReputationService;
  let repo: jest.Mocked<ReputationRepository>;

  beforeEach(async () => {
    const repoMock: jest.Mocked<ReputationRepository> = {
      findScoreByUserId: jest.fn(),
      upsertScore: jest.fn(),
      saveScore: jest.fn(),
      findExistingRating: jest.fn(),
      createRating: jest.fn(),
      findRatingsForUser: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReputationService, { provide: ReputationRepository, useValue: repoMock }],
    }).compile();

    service = module.get(ReputationService);
    repo = module.get(ReputationRepository);
  });

  // ── rateUser ──────────────────────────────────────────────────────────────

  describe('rateUser', () => {
    it('creates a rating and recalculates score', async () => {
      repo.findExistingRating.mockResolvedValue(null);
      repo.createRating.mockResolvedValue(makeRating());
      repo.findRatingsForUser.mockResolvedValue([makeRating()]);
      repo.upsertScore.mockResolvedValue(
        makeScore({ score: 4, totalRatings: 1, positiveRatings: 1 }),
      );

      const result = await service.rateUser('user-a', 'user-b', {
        conversationId: 'conv-1',
        score: 4,
      });

      expect(repo.createRating).toHaveBeenCalledWith(
        expect.objectContaining({ raterId: 'user-a', ratedUserId: 'user-b', score: 4 }),
      );
      expect(result.score).toBe(4);
    });

    it('throws ConflictException when rating already exists for conversation', async () => {
      repo.findExistingRating.mockResolvedValue(makeRating());

      await expect(
        service.rateUser('user-a', 'user-b', { conversationId: 'conv-1', score: 4 }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when user rates themselves', async () => {
      await expect(
        service.rateUser('user-a', 'user-a', { conversationId: 'conv-1', score: 5 }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── getReputation ─────────────────────────────────────────────────────────

  describe('getReputation', () => {
    it('returns score record for known user', async () => {
      repo.findScoreByUserId.mockResolvedValue(makeScore({ score: 3.5, totalRatings: 10 }));
      const result = await service.getReputation('user-b');
      expect(result.score).toBe(3.5);
      expect(result.totalRatings).toBe(10);
    });

    it('returns zeroed response for unknown user', async () => {
      repo.findScoreByUserId.mockResolvedValue(null);
      const result = await service.getReputation('unknown');
      expect(result.score).toBe(0);
      expect(result.totalRatings).toBe(0);
      expect(result.isUnderReview).toBe(false);
    });
  });

  // ── flagUser ──────────────────────────────────────────────────────────────

  describe('flagUser', () => {
    it('increments flag count', async () => {
      const score = makeScore({ flags: 1 });
      repo.findScoreByUserId.mockResolvedValue(score);
      repo.saveScore.mockResolvedValue({ ...score, flags: 2 } as ReputationScore);

      const result = await service.flagUser('flagger', 'user-b', { reason: 'Spam behaviour' });

      expect(repo.saveScore).toHaveBeenCalled();
      expect(result.flags).toBe(2);
    });

    it('sets isUnderReview when flag threshold is reached', async () => {
      const score = makeScore({ flags: 2 });
      repo.findScoreByUserId.mockResolvedValue(score);
      repo.saveScore.mockImplementation(async (s) => s);

      const result = await service.flagUser('flagger', 'user-b', { reason: 'Repeated violations' });

      expect(result.isUnderReview).toBe(true);
      expect(result.flags).toBe(3);
    });

    it('does not set isUnderReview twice', async () => {
      const score = makeScore({ flags: 5, isUnderReview: true });
      repo.findScoreByUserId.mockResolvedValue(score);
      repo.saveScore.mockImplementation(async (s) => s);

      const result = await service.flagUser('flagger', 'user-b', { reason: 'Continued behaviour' });

      expect(result.isUnderReview).toBe(true);
    });

    it('creates a score record if one does not exist yet', async () => {
      repo.findScoreByUserId.mockResolvedValue(null);
      repo.upsertScore.mockResolvedValue(makeScore({ flags: 0 }));
      repo.saveScore.mockImplementation(async (s) => s);

      const result = await service.flagUser('flagger', 'new-user', {
        reason: 'Offensive language',
      });

      expect(repo.upsertScore).toHaveBeenCalled();
      expect(result.flags).toBe(1);
    });
  });

  // ── syncFromChain ─────────────────────────────────────────────────────────

  describe('syncFromChain', () => {
    it('updates lastChainSyncAt and onChainScore', async () => {
      const synced = makeScore({ onChainScore: 3.8, lastChainSyncAt: new Date() });
      repo.upsertScore.mockResolvedValue(synced);

      const result = await service.syncFromChain('user-b');

      expect(repo.upsertScore).toHaveBeenCalledWith(
        'user-b',
        expect.objectContaining({ lastChainSyncAt: expect.any(Date) }),
      );
      expect(result.onChainScore).toBe(3.8);
    });
  });

  // ── weighted average ──────────────────────────────────────────────────────

  describe('score recalculation', () => {
    it('calculates weighted average across multiple ratings', async () => {
      const ratings = [
        makeRating({ score: 5, conversationId: 'c1' }),
        makeRating({ score: 3, conversationId: 'c2' }),
        makeRating({ score: 4, conversationId: 'c3' }),
      ];
      repo.findExistingRating.mockResolvedValue(null);
      repo.createRating.mockResolvedValue(ratings[0]);
      repo.findRatingsForUser.mockResolvedValue(ratings);
      repo.upsertScore.mockImplementation(async (_id, data) =>
        makeScore(data as Partial<ReputationScore>),
      );

      await service.rateUser('user-a', 'user-b', { conversationId: 'c1', score: 5 });

      const [, , partial] = repo.upsertScore.mock.calls[0];
      expect((partial as any).totalRatings).toBe(3);
      expect((partial as any).positiveRatings).toBe(3); // all >= 3
    });
  });
});
