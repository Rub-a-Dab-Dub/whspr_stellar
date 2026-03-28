import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  ModerationAction,
  ModerationResult,
  ModerationReviewStatus,
  ModerationTargetType,
} from '../entities/moderation-result.entity';
import { OverrideModerationDto } from '../dto/override-moderation.dto';
import { ModerationResultsQueryDto } from '../dto/moderation-results-query.dto';
import { ModerationJobPayload, ModerationQueueService } from '../queue/moderation.queue';

interface ProviderModerationResponse {
  flagged: boolean;
  categories: Record<string, number>;
  confidence: number;
  provider: string;
}

export interface ModerationStats {
  flaggedToday: number;
  categories: Record<string, number>;
  falsePositives: number;
  humanOverrideRate: number;
  pendingHumanReview: number;
  autoHidden: number;
  feedbackBacklog: number;
}

@Injectable()
export class AIModerationService {
  private readonly logger = new Logger(AIModerationService.name);

  constructor(
    @InjectRepository(ModerationResult)
    private readonly moderationRepository: Repository<ModerationResult>,
    private readonly configService: ConfigService,
    private readonly moderationQueueService: ModerationQueueService,
  ) {}

  async moderateText(
    targetType: ModerationTargetType,
    targetId: string,
    content: string,
    metadata?: Record<string, unknown>,
  ) {
    if (!content.trim()) {
      throw new BadRequestException('Content is required for text moderation');
    }

    const providerResult = await this.runProviderModeration({
      type: 'text',
      input: content,
    });

    return this.persistResult(targetType, targetId, providerResult, metadata);
  }

  async moderateImage(targetId: string, imageUrl: string, metadata?: Record<string, unknown>) {
    if (!imageUrl.trim()) {
      throw new BadRequestException('Image URL is required for image moderation');
    }

    const providerResult = await this.runProviderModeration({
      type: 'image',
      input: imageUrl,
    });

    return this.persistResult(ModerationTargetType.IMAGE, targetId, providerResult, metadata);
  }

  async handleModerationJob(payload: ModerationJobPayload): Promise<ModerationResult> {
    if (payload.imageUrl) {
      return this.moderateImage(payload.targetId, payload.imageUrl, payload.metadata);
    }

    return this.moderateText(
      payload.targetType,
      payload.targetId,
      payload.content ?? '',
      payload.metadata,
    );
  }

  async getModerationResult(id: string): Promise<ModerationResult> {
    const result = await this.moderationRepository.findOne({ where: { id } });
    if (!result) {
      throw new NotFoundException(`Moderation result ${id} not found`);
    }

    return result;
  }

  async overrideResult(id: string, dto: OverrideModerationDto): Promise<ModerationResult> {
    const result = await this.getModerationResult(id);

    result.action = dto.action;
    result.flagged = dto.flagged;
    result.reviewedByHuman = true;
    result.overrideReason = dto.reason;
    result.reviewStatus = ModerationReviewStatus.REVIEWED;
    result.humanReviewedAt = new Date();
    result.feedbackTrainedAt = null;
    result.metadata = {
      ...result.metadata,
      overridden: true,
      overrideChangedDecision: result.aiAction !== dto.action || result.aiFlagged !== dto.flagged,
    };

    return this.moderationRepository.save(result);
  }

  async getResults(query: ModerationResultsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.moderationRepository.createQueryBuilder('result');

    if (query.targetType) {
      qb.andWhere('result.targetType = :targetType', { targetType: query.targetType });
    }

    if (query.action) {
      qb.andWhere('result.action = :action', { action: query.action });
    }

    if (query.reviewStatus) {
      qb.andWhere('result.reviewStatus = :reviewStatus', {
        reviewStatus: query.reviewStatus,
      });
    }

    if (query.flagged !== undefined) {
      qb.andWhere('result.flagged = :flagged', { flagged: query.flagged === 'true' });
    }

    if (query.targetId) {
      qb.andWhere('result.targetId = :targetId', { targetId: query.targetId });
    }

    qb.orderBy('result.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getModerationStats(): Promise<ModerationStats> {
    const flaggedToday = await this.moderationRepository
      .createQueryBuilder('result')
      .where('result.flagged = :flagged', { flagged: true })
      .andWhere('result.createdAt >= CURRENT_DATE')
      .getCount();

    const flaggedResults = await this.moderationRepository.find({
      where: {
        flagged: true,
      },
    });

    const categories = flaggedResults.reduce<Record<string, number>>((acc, row) => {
      Object.entries(row.categories ?? {}).forEach(([key, value]) => {
        acc[key] = (acc[key] ?? 0) + Number(value);
      });

      return acc;
    }, {});

    const falsePositives = await this.moderationRepository.count({
      where: {
        reviewedByHuman: true,
        flagged: false,
      },
    });

    const overrides = await this.moderationRepository.count({
      where: {
        reviewedByHuman: true,
      },
    });
    const total = await this.moderationRepository.count();
    const pendingHumanReview = await this.moderationRepository.count({
      where: {
        reviewStatus: ModerationReviewStatus.PENDING,
      },
    });
    const autoHidden = await this.moderationRepository.count({
      where: {
        action: ModerationAction.HIDE,
      },
    });
    const feedbackBacklog = await this.moderationRepository.count({
      where: {
        reviewedByHuman: true,
        feedbackTrainedAt: IsNull(),
      },
    });

    return {
      flaggedToday,
      categories,
      falsePositives,
      humanOverrideRate: total === 0 ? 0 : overrides / total,
      pendingHumanReview,
      autoHidden,
      feedbackBacklog,
    };
  }

  async trainFeedback(): Promise<{ trainedOn: number }> {
    const feedbackCandidates = await this.moderationRepository.find({
      where: {
        reviewedByHuman: true,
        feedbackTrainedAt: IsNull(),
      },
    });

    if (feedbackCandidates.length === 0) {
      this.logger.log('Prepared 0 human-reviewed moderation results for feedback');
      return { trainedOn: 0 };
    }

    const trainedAt = new Date();
    await this.moderationRepository.save(
      feedbackCandidates.map((result) => ({
        ...result,
        feedbackTrainedAt: trainedAt,
        metadata: {
          ...result.metadata,
          feedbackIncludedAt: trainedAt.toISOString(),
        },
      })),
    );

    this.logger.log(
      `Prepared ${feedbackCandidates.length} human-reviewed moderation results for feedback`,
    );
    return { trainedOn: feedbackCandidates.length };
  }

  private async persistResult(
    targetType: ModerationTargetType,
    targetId: string,
    providerResult: ProviderModerationResponse,
    metadata?: Record<string, unknown>,
  ): Promise<ModerationResult> {
    const action = this.resolveAction(providerResult.flagged, providerResult.confidence);
    const now = new Date();
    const result = this.moderationRepository.create({
      targetType,
      targetId,
      flagged: providerResult.flagged,
      categories: providerResult.categories,
      confidence: providerResult.confidence,
      aiFlagged: providerResult.flagged,
      aiConfidence: providerResult.confidence,
      action,
      aiAction: action,
      reviewStatus: providerResult.flagged
        ? ModerationReviewStatus.PENDING
        : ModerationReviewStatus.NOT_REQUIRED,
      reviewedByAI: true,
      reviewedByHuman: false,
      provider: providerResult.provider,
      metadata: {
        ...metadata,
        autoHidden: action === ModerationAction.HIDE,
      },
      humanReviewQueuedAt: providerResult.flagged ? now : null,
      humanReviewedAt: null,
      feedbackTrainedAt: null,
    });

    const savedResult = await this.moderationRepository.save(result);

    if (savedResult.flagged) {
      await this.enqueueHumanReview(savedResult);
    }

    return savedResult;
  }

  private resolveAction(flagged: boolean, confidence: number): ModerationAction {
    if (!flagged) {
      return ModerationAction.NONE;
    }

    if (confidence > 0.9) {
      return ModerationAction.HIDE;
    }

    if (confidence > 0.75) {
      return ModerationAction.WARN;
    }

    return ModerationAction.NONE;
  }

  private async enqueueHumanReview(result: ModerationResult): Promise<void> {
    try {
      await this.moderationQueueService.enqueueHumanModerationReview({
        moderationResultId: result.id,
        targetType: result.targetType,
        targetId: result.targetId,
        confidence: result.confidence,
        action: result.action,
        flagged: result.flagged,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Failed to enqueue human moderation review for ${result.id}: ${message}`);
    }
  }

  private async runProviderModeration(input: {
    type: 'text' | 'image';
    input: string;
  }): Promise<ProviderModerationResponse> {
    const provider = this.configService.get<string>('AI_MODERATION_PROVIDER', 'mock');

    if (provider === 'openai') {
      return this.callOpenAI(input);
    }

    if (provider === 'perspective') {
      return this.callPerspective(input);
    }

    return this.runMockProvider(input);
  }

  private async callOpenAI(input: {
    type: 'text' | 'image';
    input: string;
  }): Promise<ProviderModerationResponse> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const baseUrl = this.configService.get<string>('OPENAI_BASE_URL', 'https://api.openai.com');

    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY missing, falling back to mock moderation provider');
      return this.runMockProvider(input);
    }

    const response = await fetch(`${baseUrl}/v1/moderations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.configService.get<string>('OPENAI_MODERATION_MODEL', 'omni-moderation-latest'),
        input:
          input.type === 'image'
            ? [{ type: 'image_url', image_url: { url: input.input } }]
            : input.input,
      }),
    });

    if (!response.ok) {
      this.logger.warn(`OpenAI moderation request failed with status ${response.status}`);
      return this.runMockProvider(input);
    }

    const body = (await response.json()) as {
      results?: Array<{
        flagged: boolean;
        categories?: Record<string, boolean>;
        category_scores?: Record<string, number>;
      }>;
    };
    const result = body.results?.[0];

    return {
      flagged: result?.flagged ?? false,
      categories: this.normalizeCategories(result?.category_scores, result?.categories),
      confidence: this.getConfidence(result?.category_scores),
      provider: 'openai',
    };
  }

  private async callPerspective(input: {
    type: 'text' | 'image';
    input: string;
  }): Promise<ProviderModerationResponse> {
    if (input.type === 'image') {
      return this.runMockProvider(input);
    }

    const apiKey = this.configService.get<string>('PERSPECTIVE_API_KEY');
    const baseUrl = this.configService.get<string>(
      'PERSPECTIVE_BASE_URL',
      'https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze',
    );

    if (!apiKey) {
      this.logger.warn('PERSPECTIVE_API_KEY missing, falling back to mock moderation provider');
      return this.runMockProvider(input);
    }

    const url = `${baseUrl}?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comment: { text: input.input },
        requestedAttributes: {
          TOXICITY: {},
          INSULT: {},
          THREAT: {},
          PROFANITY: {},
        },
      }),
    });

    if (!response.ok) {
      this.logger.warn(`Perspective moderation request failed with status ${response.status}`);
      return this.runMockProvider(input);
    }

    const body = (await response.json()) as {
      attributeScores?: Record<
        string,
        {
          summaryScore?: {
            value?: number;
          };
        }
      >;
    };

    const categories = Object.entries(body.attributeScores ?? {}).reduce<Record<string, number>>(
      (acc, [key, value]) => {
        acc[key.toLowerCase()] = value.summaryScore?.value ?? 0;
        return acc;
      },
      {},
    );
    const confidence = this.getConfidence(categories);

    return {
      flagged: confidence >= 0.5,
      categories,
      confidence,
      provider: 'perspective',
    };
  }

  private async runMockProvider(input: {
    type: 'text' | 'image';
    input: string;
  }): Promise<ProviderModerationResponse> {
    const lowerInput = input.input.toLowerCase();
    const toxicity = ['hate', 'threat', 'kill', 'violent', 'abuse'].some((term) =>
      lowerInput.includes(term),
    )
      ? 0.96
      : ['spam', 'scam', 'nsfw'].some((term) => lowerInput.includes(term))
        ? 0.82
        : 0.08;

    const categories: Record<string, number> =
      input.type === 'image'
        ? { sexual: toxicity, violence: toxicity > 0.9 ? toxicity : 0.05 }
        : { toxicity, spam: lowerInput.includes('spam') ? 0.82 : 0.03 };

    return {
      flagged: toxicity >= 0.5,
      categories,
      confidence: this.getConfidence(categories),
      provider: 'mock',
    };
  }

  private normalizeCategories(
    scores?: Record<string, number>,
    flags?: Record<string, boolean>,
  ): Record<string, number> {
    if (scores && Object.keys(scores).length > 0) {
      return Object.entries(scores).reduce<Record<string, number>>((acc, [key, value]) => {
        acc[key] = Number(value);
        return acc;
      }, {});
    }

    return Object.entries(flags ?? {}).reduce<Record<string, number>>((acc, [key, value]) => {
      acc[key] = value ? 1 : 0;
      return acc;
    }, {});
  }

  private getConfidence(categories?: Record<string, number>): number {
    if (!categories || Object.keys(categories).length === 0) {
      return 0;
    }

    return Math.max(...Object.values(categories).map((value) => Number(value)));
  }
}
