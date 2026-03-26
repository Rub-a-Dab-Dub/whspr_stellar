import { Test, TestingModule } from '@nestjs/testing';
import { SpamDetectionController } from './spam-detection.controller';
import { SpamDetectionService } from './spam-detection.service';
import { SpamScore, SpamActionType } from './entities/spam-score.entity';

describe('SpamDetectionController', () => {
  let controller: SpamDetectionController;
  let service: SpamDetectionService;

  const mockSpamScore: SpamScore = {
    id: 'score-1',
    userId: 'user-1',
    score: 45,
    factors: {},
    action: SpamActionType.WARN,
    triggeredAt: new Date(),
    reviewedAt: null,
    reviewedBy: null,
    reviewNotes: null,
    isFalsePositive: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: null as any,
  };

  const mockServiceMethods = {
    scoreMessage: jest.fn(),
    scoreUser: jest.fn(),
    flagContent: jest.fn(),
    getSpamHistory: jest.fn(),
    updateSpamScore: jest.fn(),
    triggerAction: jest.fn(),
    reviewSpamScore: jest.fn(),
    getSpamStats: jest.fn(),
    getPendingReviewQueue: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SpamDetectionController],
      providers: [
        {
          provide: SpamDetectionService,
          useValue: mockServiceMethods,
        },
      ],
    }).compile();

    controller = module.get<SpamDetectionController>(SpamDetectionController);
    service = module.get<SpamDetectionService>(SpamDetectionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('scoreMessage', () => {
    it('should queue message for scoring', async () => {
      mockServiceMethods.scoreMessage.mockResolvedValue({
        jobId: 'job-1',
        status: 'queued',
      });

      const result = await controller.scoreMessage({
        messageId: 'msg-1',
        content: 'Test message',
        senderId: 'user-1',
      });

      expect(result.status).toBe('queued');
      expect(mockServiceMethods.scoreMessage).toHaveBeenCalledWith(
        expect.objectContaining({ messageId: 'msg-1' }),
      );
    });
  });

  describe('scoreUser', () => {
    it('should score user on demand', async () => {
      mockServiceMethods.scoreUser.mockResolvedValue(mockSpamScore);

      const result = await controller.scoreUser({
        userId: 'user-1',
        reason: 'manual_review',
      });

      expect(result.userId).toBe('user-1');
      expect(mockServiceMethods.scoreUser).toHaveBeenCalled();
    });
  });

  describe('flagContent', () => {
    it('should flag content as spam', async () => {
      mockServiceMethods.flagContent.mockResolvedValue(mockSpamScore);

      const result = await controller.flagContent({
        contentId: 'content-1',
        contentType: 'message',
        reportedBy: 'user-2',
        reason: 'Spam',
      });

      expect(result.userId).toBe('user-1');
      expect(mockServiceMethods.flagContent).toHaveBeenCalled();
    });
  });

  describe('getReviewQueue', () => {
    it('should return pending review queue', async () => {
      mockServiceMethods.getPendingReviewQueue.mockResolvedValue([
        {
          id: 'score-1',
          userId: 'user-1',
          username: 'testuser',
          score: 45,
          action: SpamActionType.WARN,
          factors: {},
          triggeredAt: new Date(),
          daysSinceFlag: 2,
        },
      ]);

      const result = await controller.getReviewQueue(50);

      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('testuser');
      expect(mockServiceMethods.getPendingReviewQueue).toHaveBeenCalledWith(50);
    });

    it('should limit results to 100', async () => {
      mockServiceMethods.getPendingReviewQueue.mockResolvedValue([]);

      await controller.getReviewQueue(200);

      expect(mockServiceMethods.getPendingReviewQueue).toHaveBeenCalledWith(100);
    });
  });

  describe('reviewSpamScore', () => {
    it('should approve spam score', async () => {
      mockServiceMethods.reviewSpamScore.mockResolvedValue(mockSpamScore);

      const result = await controller.reviewSpamScore('score-1', {
        decision: 'approve',
        notes: 'Confirmed spam',
      } as any, { user: { id: 'admin-1' } });

      expect(result.userId).toBe('user-1');
      expect(mockServiceMethods.reviewSpamScore).toHaveBeenCalledWith(
        'score-1',
        'admin-1',
        expect.objectContaining({ decision: 'approve' }),
      );
    });

    it('should reject as false positive', async () => {
      mockServiceMethods.reviewSpamScore.mockResolvedValue({
        ...mockSpamScore,
        score: 0,
        isFalsePositive: true,
      });

      const result = await controller.reviewSpamScore('score-1', {
        decision: 'reject_false_positive',
        notes: 'Not spam',
      } as any, { user: { id: 'admin-1' } });

      expect(result.isFalsePositive).toBe(true);
      expect(mockServiceMethods.reviewSpamScore).toHaveBeenCalled();
    });

    it('should adjust score', async () => {
      mockServiceMethods.reviewSpamScore.mockResolvedValue({
        ...mockSpamScore,
        score: 50,
      });

      const result = await controller.reviewSpamScore('score-1', {
        decision: 'adjust',
        adjustedScore: 50,
        notes: 'Adjusted based on review',
      } as any, { user: { id: 'admin-1' } });

      expect(result.score).toBe(50);
    });
  });

  describe('getStats', () => {
    it('should return spam statistics', async () => {
      mockServiceMethods.getSpamStats.mockResolvedValue({
        totalUsers: 100,
        highRiskUsers: 15,
        warnedUsers: 20,
        throttledUsers: 15,
        suspendedUsers: 5,
        averageScore: 25.5,
        actionBreakdown: {
          none: 60,
          warn: 20,
          throttle: 15,
          suspend: 5,
        },
      });

      const result = await controller.getStats();

      expect(result.totalUsers).toBe(100);
      expect(result.highRiskUsers).toBe(15);
      expect(result.actionBreakdown).toBeDefined();
      expect(mockServiceMethods.getSpamStats).toHaveBeenCalled();
    });
  });

  describe('getUserHistory', () => {
    it('should return user spam history', async () => {
      mockServiceMethods.getSpamHistory.mockResolvedValue([mockSpamScore]);

      const result = await controller.getUserHistory('user-1', 10);

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user-1');
      expect(mockServiceMethods.getSpamHistory).toHaveBeenCalledWith('user-1', 10);
    });

    it('should limit results to 100', async () => {
      mockServiceMethods.getSpamHistory.mockResolvedValue([]);

      await controller.getUserHistory('user-1', 200);

      expect(mockServiceMethods.getSpamHistory).toHaveBeenCalledWith('user-1', 100);
    });
  });
});
