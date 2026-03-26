import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Queue } from 'bull';
import { SpamDetectionService } from './spam-detection.service';
import { SpamScoresRepository } from './spam-scores.repository';
import { SpamScore, SpamActionType } from './entities/spam-score.entity';

jest.mock('axios');

describe('SpamDetectionService', () => {
  let service: SpamDetectionService;
  let repository: SpamScoresRepository;
  let configService: ConfigService;
  let spamQueue: Queue;

  const mockSpamScore: SpamScore = {
    id: 'score-1',
    userId: 'user-1',
    score: 45,
    factors: {
      messageFrequency: { count: 25, period: '1h', threshold: 20, weight: 20 },
      contentHash: { duplicateCount: 2, consecutiveRepeats: 0, weight: 15 },
    },
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

  const mockRepositoryMethods = {
    findByUserId: jest.fn(),
    findHighScoreUsersQuery: jest.fn(),
    findByAction: jest.fn(),
    findPendingReview: jest.fn(),
    findRecentWithHighScores: jest.fn(),
    countByAction: jest.fn(),
    countAboveThreshold: jest.fn(),
    getAverageScore: jest.fn(),
    getStatsByAction: jest.fn(),
    findUserSpamHistory: jest.fn(),
    markAsReviewed: jest.fn(),
    bulkUpdateScores: jest.fn(),
    findOne: jest.fn(),
    upsert: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
  };

  const mockQueueMethods = {
    add: jest.fn(),
    process: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpamDetectionService,
        {
          provide: SpamScoresRepository,
          useValue: mockRepositoryMethods,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'PERSPECTIVE_API_KEY') return 'test-api-key';
              return undefined;
            }),
          },
        },
        {
          provide: 'BullQueue_spam-detection',
          useValue: mockQueueMethods,
        },
      ],
    })
      .overrideProvider('BullQueue_spam-detection')
      .useValue(mockQueueMethods)
      .compile();

    service = module.get<SpamDetectionService>(SpamDetectionService);
    repository = module.get<SpamScoresRepository>(SpamScoresRepository);
    configService = module.get<ConfigService>(ConfigService);
    spamQueue = module.get<Queue>('BullQueue_spam-detection');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('scoreMessage', () => {
    it('should queue message for scoring without blocking', async () => {
      mockQueueMethods.add.mockResolvedValue({ id: 'job-1' });

      const result = await service.scoreMessage({
        messageId: 'msg-1',
        content: 'Test message',
        senderId: 'user-1',
        recipientIds: ['user-2'],
      });

      expect(result.status).toBe('queued');
      expect(mockQueueMethods.add).toHaveBeenCalledWith(
        'score-message',
        expect.objectContaining({ messageId: 'msg-1' }),
        expect.any(Object),
      );
    });

    it('should throw error for empty message content', async () => {
      await expect(
        service.scoreMessage({
          messageId: 'msg-1',
          content: '',
          senderId: 'user-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error for whitespace-only content', async () => {
      await expect(
        service.scoreMessage({
          messageId: 'msg-1',
          content: '   ',
          senderId: 'user-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('scoreUser', () => {
    it('should recalculate user spam score', async () => {
      mockRepositoryMethods.findByUserId.mockResolvedValue(mockSpamScore);
      mockRepositoryMethods.upsert.mockResolvedValue({
        generatedMaps: [mockSpamScore],
      });

      const result = await service.scoreUser({
        userId: 'user-1',
        reason: 'manual_review',
      });

      expect(result.userId).toBe('user-1');
      expect(mockRepositoryMethods.upsert).toHaveBeenCalled();
    });

    it('should create new score record if user not exists', async () => {
      mockRepositoryMethods.findByUserId.mockResolvedValue(null);
      mockRepositoryMethods.upsert.mockResolvedValue({
        generatedMaps: [mockSpamScore],
      });

      const result = await service.scoreUser({
        userId: 'new-user',
      });

      expect(result.userId).toBe('user-1');
      expect(mockRepositoryMethods.upsert).toHaveBeenCalled();
    });
  });

  describe('flagContent', () => {
    it('should flag content and increment report count', async () => {
      mockRepositoryMethods.findByUserId.mockResolvedValue(mockSpamScore);
      mockRepositoryMethods.save.mockResolvedValue(mockSpamScore);

      const result = await service.flagContent({
        contentId: 'content-1',
        contentType: 'message',
        reportedBy: 'user-2',
        reason: 'Spam',
      });

      expect(result.userId).toBeTruthy();
      expect(mockRepositoryMethods.save).toHaveBeenCalled();
    });

    it('should throw error for missing reason', async () => {
      await expect(
        service.flagContent({
          contentId: 'content-1',
          contentType: 'message',
          reportedBy: 'user-2',
          reason: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getSpamHistory', () => {
    it('should return user spam history with limit', async () => {
      mockRepositoryMethods.findUserSpamHistory.mockResolvedValue([mockSpamScore]);

      const result = await service.getSpamHistory('user-1', 10);

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user-1');
      expect(mockRepositoryMethods.findUserSpamHistory).toHaveBeenCalledWith('user-1', 10);
    });
  });

  describe('updateSpamScore', () => {
    it('should update spam score and determine action', async () => {
      mockRepositoryMethods.upsert.mockResolvedValue({
        generatedMaps: [mockSpamScore],
      });

      const result = await service.updateSpamScore('user-1', 45, {
        messageFrequency: { count: 25, period: '1h', threshold: 20, weight: 20 },
      });

      expect(result.userId).toBe('user-1');
      expect(result.score).toBe(45);
      expect(mockRepositoryMethods.upsert).toHaveBeenCalled();
    });

    it('should throw error for score out of range', async () => {
      await expect(
        service.updateSpamScore('user-1', 150, {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('triggerAction', () => {
    it('should trigger action for flagged user', async () => {
      const warnScore = { ...mockSpamScore, score: 35, action: SpamActionType.WARN };
      mockRepositoryMethods.findOne.mockResolvedValue(warnScore);
      mockRepositoryMethods.save.mockResolvedValue(warnScore);

      const result = await service.triggerAction('score-1');

      expect(result.action).toBeTruthy();
      expect(mockRepositoryMethods.save).toHaveBeenCalled();
    });

    it('should throw error if score record not found', async () => {
      mockRepositoryMethods.findOne.mockResolvedValue(null);

      await expect(service.triggerAction('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw error if score below threshold', async () => {
      const lowScore = { ...mockSpamScore, score: 10, action: SpamActionType.NONE };
      mockRepositoryMethods.findOne.mockResolvedValue(lowScore);

      await expect(service.triggerAction('score-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('processMessageScoring', () => {
    it('should process message and calculate factors', async () => {
      mockRepositoryMethods.upsert.mockResolvedValue({
        generatedMaps: [mockSpamScore],
      });
      (axios.post as jest.Mock).mockResolvedValue({
        data: { attributeScores: {} },
      });

      await service.processMessageScoring({
        messageId: 'msg-1',
        content: 'Spam spam spam',
        senderId: 'user-1',
        recipientIds: ['user-2', 'user-3'],
        ipAddress: '192.168.1.1',
      });

      expect(mockRepositoryMethods.upsert).toHaveBeenCalled();
    });
  });

  describe('scoring thresholds', () => {
    it('should set WARN action at ~30 score', async () => {
      mockRepositoryMethods.upsert.mockResolvedValue({
        generatedMaps: [{ ...mockSpamScore, score: 30, action: SpamActionType.WARN }],
      });

      const result = await service.updateSpamScore('user-1', 30, {});

      expect(result.action).toContain(SpamActionType.WARN);
    });

    it('should set THROTTLE action at ~60 score', async () => {
      mockRepositoryMethods.upsert.mockResolvedValue({
        generatedMaps: [{ ...mockSpamScore, score: 60, action: SpamActionType.THROTTLE }],
      });

      const result = await service.updateSpamScore('user-1', 60, {});

      expect(result.action).toContain(SpamActionType.THROTTLE);
    });

    it('should set SUSPEND action at ~85 score', async () => {
      mockRepositoryMethods.upsert.mockResolvedValue({
        generatedMaps: [{ ...mockSpamScore, score: 85, action: SpamActionType.SUSPEND }],
      });

      const result = await service.updateSpamScore('user-1', 85, {});

      expect(result.action).toContain(SpamActionType.SUSPEND);
    });
  });

  describe('reviewSpamScore', () => {
    it('should mark score as reviewed', async () => {
      mockRepositoryMethods.findOne.mockResolvedValue(mockSpamScore);
      mockRepositoryMethods.markAsReviewed.mockResolvedValue(mockSpamScore);

      const result = await service.reviewSpamScore('score-1', 'admin-1', {
        decision: 'approve',
        notes: 'Confirmed spam',
      });

      expect(result.id).toBe('score-1');
      expect(mockRepositoryMethods.markAsReviewed).toHaveBeenCalled();
    });

    it('should reset score on false positive', async () => {
      mockRepositoryMethods.findOne.mockResolvedValue(mockSpamScore);
      mockRepositoryMethods.markAsReviewed.mockResolvedValue({
        ...mockSpamScore,
        score: 0,
        isFalsePositive: true,
      });

      const result = await service.reviewSpamScore('score-1', 'admin-1', {
        decision: 'reject_false_positive',
        notes: 'User not actually spamming',
      });

      expect(result.isFalsePositive).toBe(true);
    });

    it('should throw error if score not found', async () => {
      mockRepositoryMethods.findOne.mockResolvedValue(null);

      await expect(
        service.reviewSpamScore('nonexistent', 'admin-1', { decision: 'approve' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSpamStats', () => {
    it('should return spam statistics', async () => {
      mockRepositoryMethods.count.mockResolvedValue(100);
      mockRepositoryMethods.countAboveThreshold.mockResolvedValue(15);
      mockRepositoryMethods.countByAction.mockResolvedValue(10);
      mockRepositoryMethods.getAverageScore.mockResolvedValue(25.5);
      mockRepositoryMethods.getStatsByAction.mockResolvedValue([
        { action: 'none', count: 60 },
        { action: 'warn', count: 20 },
        { action: 'throttle', count: 15 },
        { action: 'suspend', count: 5 },
      ]);

      const result = await service.getSpamStats();

      expect(result.totalUsers).toBe(100);
      expect(result.highRiskUsers).toBe(15);
      expect(result.averageScore).toBe(25.5);
      expect(result.actionBreakdown).toBeDefined();
    });
  });

  describe('getPendingReviewQueue', () => {
    it('should return pending review queue', async () => {
      mockRepositoryMethods.findPendingReview.mockResolvedValue([mockSpamScore]);

      const result = await service.getPendingReviewQueue(50);

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user-1');
      expect(mockRepositoryMethods.findPendingReview).toHaveBeenCalledWith(50);
    });
  });
});
