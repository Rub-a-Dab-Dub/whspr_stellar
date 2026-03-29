import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { plainToInstance } from 'class-transformer';
import { ReputationRepository } from './reputation.repository';
import { ReputationScore } from './entities/reputation-score.entity';
import { RateUserDto } from './dto/rate-user.dto';
import { FlagUserDto } from './dto/flag-user.dto';
import {
  FlagListResponseDto,
  RatingResponseDto,
  ReputationResponseDto,
} from './dto/reputation-response.dto';

const FLAG_REVIEW_THRESHOLD = 3;
const POSITIVE_SCORE_THRESHOLD = 3; // scores >= this count as positive
const CHAIN_SYNC_INTERVAL_MS = 30_000;

@Injectable()
export class ReputationService {
  private readonly logger = new Logger(ReputationService.name);

constructor(
    private readonly repo: ReputationRepository,
    private readonly trustService: TrustNetworkService,
  ) {}

  // ── Rating ────────────────────────────────────────────────────────────────

  async rateUser(
    raterId: string,
    ratedUserId: string,
    dto: RateUserDto,
  ): Promise<RatingResponseDto> {
    if (raterId === ratedUserId) {
      throw new ConflictException('Users cannot rate themselves');
    }

    const existing = await this.repo.findExistingRating(raterId, dto.conversationId);
    if (existing) {
      throw new ConflictException('You have already rated this user for this conversation');
    }

    const rating = await this.repo.createRating({
      raterId,
      ratedUserId,
      conversationId: dto.conversationId,
      score: dto.score,
      comment: dto.comment ?? null,
    });

    await this.recalculateScore(ratedUserId);

    return plainToInstance(RatingResponseDto, rating, { excludeExtraneousValues: true });
  }

  // ── Reputation ────────────────────────────────────────────────────────────

  async getReputation(userId: string): Promise<ReputationResponseDto> {
    const ratingScore = await this.repo.findScoreByUserId(userId);
    const trustScoreData = await this.trustService.getTrustScore(userId);
    const trustScore = trustScoreData.score;
    const aggregateScore = ratingScore ? (ratingScore.score * 0.7 + trustScore * 0.3) : trustScore;

    if (!ratingScore) {
      // Return zeroed rating + trust
      return plainToInstance(
        ReputationResponseDto,
        {
          userId,
          score: aggregateScore,
          totalRatings: 0,
          positiveRatings: 0,
          flags: 0,
          isUnderReview: false,
          onChainScore: null,
          lastChainSyncAt: null,
          lastUpdatedAt: new Date(),
        },
        { excludeExtraneousValues: true },
      );
    }

    ratingScore.score = aggregateScore;
    return plainToInstance(ReputationResponseDto, ratingScore, { excludeExtraneousValues: true });
  }

  // ── Flagging ──────────────────────────────────────────────────────────────

  async flagUser(
    _flaggerId: string,
    targetUserId: string,
    _dto: FlagUserDto,
  ): Promise<FlagListResponseDto> {
    let score = await this.repo.findScoreByUserId(targetUserId);
    if (!score) {
      score = await this.repo.upsertScore(targetUserId, {});
    }

    score.flags += 1;

    if (score.flags >= FLAG_REVIEW_THRESHOLD && !score.isUnderReview) {
      score.isUnderReview = true;
      this.logger.warn(
        `User ${targetUserId} has been placed under automatic review after ${score.flags} flags`,
      );
      await this.triggerAutoReview(targetUserId, score.flags);
    }

    await this.repo.saveScore(score);

    return { userId: targetUserId, flags: score.flags, isUnderReview: score.isUnderReview };
  }

  async getFlags(userId: string): Promise<FlagListResponseDto> {
    const score = await this.repo.findScoreByUserId(userId);
    return {
      userId,
      flags: score?.flags ?? 0,
      isUnderReview: score?.isUnderReview ?? false,
    };
  }

  // ── Chain Sync ────────────────────────────────────────────────────────────

  async syncFromChain(userId: string): Promise<ReputationResponseDto> {
    const onChainScore = await this.fetchOnChainScore(userId);
    const record = await this.repo.upsertScore(userId, {
      onChainScore,
      lastChainSyncAt: new Date(),
    });
    return plainToInstance(ReputationResponseDto, record, { excludeExtraneousValues: true });
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async reconcileChainScores(): Promise<void> {
    this.logger.debug('Running on-chain reputation reconciliation');
    // In production this would page through all users with stale sync timestamps.
    // Kept as a hook for the cron infrastructure — individual syncs happen via syncFromChain().
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private async recalculateScore(userId: string): Promise<void> {
    const ratings = await this.repo.findRatingsForUser(userId);

    if (ratings.length === 0) return;

    const total = ratings.length;
    const sumWeighted = ratings.reduce((acc, r, idx) => {
      // Recency weight: more recent ratings carry slightly more weight.
      const weight = 1 + idx * 0.01;
      return acc + r.score * weight;
    }, 0);
    const totalWeight = ratings.reduce((acc, _r, idx) => acc + 1 + idx * 0.01, 0);

    const weightedAvg = parseFloat((sumWeighted / totalWeight).toFixed(2));
    const positive = ratings.filter((r) => r.score >= POSITIVE_SCORE_THRESHOLD).length;

    await this.repo.upsertScore(userId, {
      score: weightedAvg,
      totalRatings: total,
      positiveRatings: positive,
    });
  }

  private async fetchOnChainScore(userId: string): Promise<number> {
    // Stub: replace with actual Soroban contract call via StellarSdk.
    // e.g. call the reputation contract's get_reputation(userId) view function.
    this.logger.debug(`Fetching on-chain score for user ${userId}`);
    return 0;
  }

  private async triggerAutoReview(userId: string, flagCount: number): Promise<void> {
    // Stub: emit an internal event, notify an admin queue, or call a moderation service.
    this.logger.warn(`Auto-review triggered for user ${userId} with ${flagCount} flags`);
  }
}
