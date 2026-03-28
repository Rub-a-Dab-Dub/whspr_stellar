import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIModerationService } from './ai-moderation.service';
import {
  ModerationAction,
  ModerationResult,
  ModerationReviewStatus,
  ModerationTargetType,
} from '../entities/moderation-result.entity';
import { ModerationQueueService } from '../queue/moderation.queue';

describe('AIModerationService', () => {
  let service: AIModerationService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    count: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let configService: { get: jest.Mock };
  let moderationQueueService: {
    enqueueHumanModerationReview: jest.Mock;
  };
  let fetchMock: jest.Mock;

  const mockResult: ModerationResult = {
    id: '8ce5a352-0db2-46b5-a507-89ec71c8a001',
    targetType: ModerationTargetType.PROFILE,
    targetId: '2f2fcb34-d421-4b08-b08e-e5ed9dd9d9d0',
    flagged: true,
    categories: { toxicity: 0.96 },
    confidence: 0.96,
    aiFlagged: true,
    aiConfidence: 0.96,
    action: ModerationAction.HIDE,
    aiAction: ModerationAction.HIDE,
    reviewStatus: ModerationReviewStatus.PENDING,
    reviewedByAI: true,
    reviewedByHuman: false,
    overrideReason: null,
    provider: 'mock',
    metadata: { autoHidden: true },
    humanReviewQueuedAt: new Date('2026-03-28T09:00:00.000Z'),
    humanReviewedAt: null,
    feedbackTrainedAt: null,
    createdAt: new Date('2026-03-28T09:00:00.000Z'),
    updatedAt: new Date('2026-03-28T09:00:00.000Z'),
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn().mockImplementation((input) => input),
      save: jest.fn().mockImplementation(async (input) => {
        if (Array.isArray(input)) {
          return input.map((row) => ({
            createdAt: mockResult.createdAt,
            updatedAt: mockResult.updatedAt,
            ...row,
          }));
        }

        return {
          id: mockResult.id,
          createdAt: mockResult.createdAt,
          updatedAt: mockResult.updatedAt,
          ...input,
        };
      }),
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    configService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'AI_MODERATION_PROVIDER') {
          return 'mock';
        }

        return defaultValue;
      }),
    };

    moderationQueueService = {
      enqueueHumanModerationReview: jest.fn(),
    };

    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIModerationService,
        {
          provide: getRepositoryToken(ModerationResult),
          useValue: repository,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: ModerationQueueService,
          useValue: moderationQueueService,
        },
      ],
    }).compile();

    service = module.get(AIModerationService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('moderates text and auto-hides high-confidence content', async () => {
    const result = await service.moderateText(
      ModerationTargetType.PROFILE,
      mockResult.targetId,
      'This profile contains violent hate speech',
      { source: 'profile-update' },
    );

    expect(result.flagged).toBe(true);
    expect(result.action).toBe(ModerationAction.HIDE);
    expect(result.aiAction).toBe(ModerationAction.HIDE);
    expect(result.reviewStatus).toBe(ModerationReviewStatus.PENDING);
    expect(result.provider).toBe('mock');
    expect(result.metadata).toEqual({
      autoHidden: true,
      source: 'profile-update',
    });
    expect(moderationQueueService.enqueueHumanModerationReview).toHaveBeenCalledWith(
      expect.objectContaining({
        moderationResultId: mockResult.id,
        targetId: mockResult.targetId,
        flagged: true,
      }),
    );
  });

  it('moderates images via the image flow', async () => {
    const result = await service.moderateImage(mockResult.targetId, 'https://example.com/nsfw.png');

    expect(result.targetType).toBe(ModerationTargetType.IMAGE);
    expect(result.flagged).toBe(true);
    expect(moderationQueueService.enqueueHumanModerationReview).toHaveBeenCalled();
  });

  it('rejects blank text moderation requests', async () => {
    await expect(
      service.moderateText(ModerationTargetType.USER, mockResult.targetId, '   '),
    ).rejects.toThrow(BadRequestException);
  });

  it('handles queued text moderation jobs', async () => {
    const result = await service.handleModerationJob({
      targetType: ModerationTargetType.USER,
      targetId: mockResult.targetId,
      content: 'friendly hello',
      metadata: { source: 'job' },
    });

    expect(result.flagged).toBe(false);
    expect(result.action).toBe(ModerationAction.NONE);
    expect(result.reviewStatus).toBe(ModerationReviewStatus.NOT_REQUIRED);
  });

  it('returns a moderation result by id', async () => {
    repository.findOne.mockResolvedValue(mockResult);

    const result = await service.getModerationResult(mockResult.id);

    expect(result.id).toBe(mockResult.id);
    expect(repository.findOne).toHaveBeenCalledWith({ where: { id: mockResult.id } });
  });

  it('applies human overrides and resets feedback backlog', async () => {
    repository.findOne.mockResolvedValue(mockResult);
    repository.save.mockResolvedValue({
      ...mockResult,
      action: ModerationAction.WARN,
      flagged: false,
      reviewedByHuman: true,
      reviewStatus: ModerationReviewStatus.REVIEWED,
      overrideReason: 'False positive',
      feedbackTrainedAt: null,
      metadata: {
        autoHidden: true,
        overridden: true,
        overrideChangedDecision: true,
      },
    });

    const result = await service.overrideResult(mockResult.id, {
      action: ModerationAction.WARN,
      flagged: false,
      reason: 'False positive',
    });

    expect(result.reviewedByHuman).toBe(true);
    expect(result.overrideReason).toBe('False positive');
    expect(result.reviewStatus).toBe(ModerationReviewStatus.REVIEWED);
    expect(result.metadata.overrideChangedDecision).toBe(true);
  });

  it('throws when overriding an unknown result', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(
      service.overrideResult(mockResult.id, {
        action: ModerationAction.NONE,
        flagged: false,
        reason: 'No record',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns paginated moderation results', async () => {
    const qb = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[mockResult], 1]),
    };
    repository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getResults({
      page: 1,
      limit: 20,
      flagged: 'true',
      targetType: ModerationTargetType.PROFILE,
      action: ModerationAction.HIDE,
      targetId: mockResult.targetId,
    });

    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(qb.andWhere).toHaveBeenCalledTimes(4);
  });

  it('computes moderation stats and feedback totals', async () => {
    const countQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(3),
    };

    repository.createQueryBuilder.mockReturnValue(countQueryBuilder);
    repository.find
      .mockResolvedValueOnce([
        mockResult,
        {
          ...mockResult,
          id: '7e169db2-cfbf-4c6d-af35-7fe607ba8db9',
          categories: { spam: 0.82 },
        },
      ])
      .mockResolvedValueOnce([
        {
          ...mockResult,
          reviewedByHuman: true,
          reviewStatus: ModerationReviewStatus.REVIEWED,
          feedbackTrainedAt: null,
        },
      ]);
    repository.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1);

    const stats = await service.getModerationStats();
    const feedback = await service.trainFeedback();

    expect(stats.flaggedToday).toBe(3);
    expect(stats.categories.toxicity).toBe(0.96);
    expect(stats.categories.spam).toBe(0.82);
    expect(stats.falsePositives).toBe(2);
    expect(stats.humanOverrideRate).toBe(0.5);
    expect(stats.pendingHumanReview).toBe(1);
    expect(stats.autoHidden).toBe(3);
    expect(stats.feedbackBacklog).toBe(1);
    expect(feedback.trainedOn).toBe(1);
    expect(repository.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          feedbackTrainedAt: expect.any(Date),
        }),
      ]),
    );
  });

  it('calls the OpenAI moderation API when configured', async () => {
    configService.get.mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === 'AI_MODERATION_PROVIDER') {
        return 'openai';
      }
      if (key === 'OPENAI_API_KEY') {
        return 'test-key';
      }
      if (key === 'OPENAI_BASE_URL') {
        return 'https://api.openai.test';
      }
      if (key === 'OPENAI_MODERATION_MODEL') {
        return 'omni-moderation-latest';
      }

      return defaultValue;
    });

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            flagged: true,
            category_scores: {
              violence: 0.94,
              harassment: 0.14,
            },
          },
        ],
      }),
    });

    const result = await service.moderateText(
      ModerationTargetType.MESSAGE,
      mockResult.targetId,
      'violent threat',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.test/v1/moderations',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(result.provider).toBe('openai');
    expect(result.categories.violence).toBe(0.94);
    expect(result.action).toBe(ModerationAction.HIDE);
  });

  it('calls the Perspective API when configured', async () => {
    configService.get.mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === 'AI_MODERATION_PROVIDER') {
        return 'perspective';
      }
      if (key === 'PERSPECTIVE_API_KEY') {
        return 'perspective-key';
      }
      if (key === 'PERSPECTIVE_BASE_URL') {
        return 'https://perspective.test/analyze';
      }

      return defaultValue;
    });

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        attributeScores: {
          TOXICITY: {
            summaryScore: { value: 0.88 },
          },
          THREAT: {
            summaryScore: { value: 0.41 },
          },
        },
      }),
    });

    const result = await service.moderateText(
      ModerationTargetType.MESSAGE,
      mockResult.targetId,
      'aggressive text',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://perspective.test/analyze?key=perspective-key',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(result.provider).toBe('perspective');
    expect(result.categories.toxicity).toBe(0.88);
    expect(result.action).toBe(ModerationAction.WARN);
  });
});
