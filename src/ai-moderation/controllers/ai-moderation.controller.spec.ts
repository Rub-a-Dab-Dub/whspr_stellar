import { Test, TestingModule } from '@nestjs/testing';
import { AIModerationController } from './ai-moderation.controller';
import { AIModerationService } from '../services/ai-moderation.service';
import {
  ModerationAction,
  ModerationReviewStatus,
  ModerationTargetType,
} from '../entities/moderation-result.entity';

describe('AIModerationController', () => {
  let controller: AIModerationController;
  let service: jest.Mocked<AIModerationService>;

  const serviceMock = {
    getResults: jest.fn(),
    overrideResult: jest.fn(),
    getModerationStats: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AIModerationController],
      providers: [
        {
          provide: AIModerationService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get(AIModerationController);
    service = module.get(AIModerationService);
    jest.clearAllMocks();
  });

  it('returns moderation results', async () => {
    service.getResults.mockResolvedValue({
      data: [],
      meta: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 1,
      },
    });

    const query = {
      targetType: ModerationTargetType.PROFILE,
      flagged: 'true',
      page: 1,
      limit: 20,
    };
    const result = await controller.getResults(query);

    expect(result.meta.total).toBe(0);
    expect(service.getResults).toHaveBeenCalledWith(query);
  });

  it('applies overrides', async () => {
    service.overrideResult.mockResolvedValue({
      id: 'result-id',
      targetType: ModerationTargetType.PROFILE,
      targetId: 'target-id',
      flagged: false,
      categories: {},
      confidence: 0.1,
      aiFlagged: true,
      aiConfidence: 0.91,
      action: ModerationAction.NONE,
      aiAction: ModerationAction.HIDE,
      reviewStatus: ModerationReviewStatus.REVIEWED,
      reviewedByAI: true,
      reviewedByHuman: true,
      overrideReason: 'Looks fine',
      provider: 'mock',
      metadata: { overridden: true },
      humanReviewQueuedAt: new Date(),
      humanReviewedAt: new Date(),
      feedbackTrainedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const dto = {
      action: ModerationAction.NONE,
      flagged: false,
      reason: 'Looks fine',
    };
    const result = await controller.overrideResult('result-id', dto);

    expect(result.reviewedByHuman).toBe(true);
    expect(service.overrideResult).toHaveBeenCalledWith('result-id', dto);
  });

  it('returns moderation stats', async () => {
    service.getModerationStats.mockResolvedValue({
      flaggedToday: 2,
      categories: { toxicity: 1.4 },
      falsePositives: 1,
      humanOverrideRate: 0.25,
      pendingHumanReview: 3,
      autoHidden: 4,
      feedbackBacklog: 2,
    });

    const result = await controller.getStats();

    expect(result.flaggedToday).toBe(2);
    expect(result.pendingHumanReview).toBe(3);
    expect(service.getModerationStats).toHaveBeenCalled();
  });
});
