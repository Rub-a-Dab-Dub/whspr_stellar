import { Injectable, Logger, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import axios } from 'axios';
import { plainToInstance } from 'class-transformer';
import { SpamScoresRepository } from './spam-scores.repository';
import { SpamScore, SpamActionType, SpamScoreFactors } from './entities/spam-score.entity';
import {
  ScoreMessageDto,
  ScoreUserDto,
  FlagContentDto,
  SpamScoreResponseDto,
  AdminReviewDto,
} from './dto/spam.dto';

@Injectable()
export class SpamDetectionService {
  private readonly logger = new Logger(SpamDetectionService.name);
  private readonly WARN_THRESHOLD = 30;
  private readonly THROTTLE_THRESHOLD = 60;
  private readonly SUSPEND_THRESHOLD = 85;

  constructor(
    private readonly spamScoresRepository: SpamScoresRepository,
    private readonly configService: ConfigService,
    @InjectQueue('spam-detection') private readonly spamQueue: Queue,
  ) {}

  /**
   * Queue message for spam scoring (async, non-blocking)
   * Stores message metadata and triggers async scoring job
   */
  async scoreMessage(dto: ScoreMessageDto): Promise<{ jobId: string; status: string }> {
    if (!dto.content || dto.content.trim().length === 0) {
      throw new BadRequestException('Message content cannot be empty');
    }

    // Queue the scoring job - does not block delivery
    const job = await this.spamQueue.add(
      'score-message',
      {
        messageId: dto.messageId,
        content: dto.content,
        senderId: dto.senderId,
        recipientIds: dto.recipientIds || [],
        ipAddress: dto.ipAddress,
        scoredAt: new Date(),
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: false,
      },
    );

    return {
      jobId: job.id.toString(),
      status: 'queued',
    };
  }

  /**
   * Immediately recalculate user's spam score
   * Called after manual review or threshold breach
   */
  async scoreUser(dto: ScoreUserDto): Promise<SpamScoreResponseDto> {
    const existingScore = await this.spamScoresRepository.findByUserId(dto.userId);

    // Recalculate based on recent activity
    // This is simplified - in production would analyze messages, reports, etc
    const factors: SpamScoreFactors = existingScore?.factors || {};

    const newScore = this.calculateScoreFromFactors(factors);
    const action = this.determineAction(newScore);

    const updated = await this.spamScoresRepository.upsert(
      {
        userId: dto.userId,
        score: newScore,
        factors,
        action,
        triggeredAt: action !== SpamActionType.NONE ? new Date() : null,
      },
      ['userId'],
    );

    return this.mapToResponseDto(updated.generatedMaps[0] as any);
  }

  /**
   * Flag content as spam/abuse (human report)
   * Increments spam score and triggers action if threshold breached
   */
  async flagContent(dto: FlagContentDto): Promise<SpamScoreResponseDto> {
    if (!dto.reason || dto.reason.trim().length === 0) {
      throw new BadRequestException('Report reason required');
    }

    // Extract userId from contentId (simplified - assumes contentId format)
    // In production, would lookup content to get userId
    const userId = dto.reportedBy; // Placeholder

    let spamScore = await this.spamScoresRepository.findByUserId(userId);

    if (!spamScore) {
      spamScore = this.spamScoresRepository.create({
        userId,
        score: 0,
        factors: {
          reportCount: { count: 0, weight: 15 },
        },
      });
    }

    // Increment report count
    const factors = spamScore.factors || {};
    if (!factors.reportCount) {
      factors.reportCount = { count: 0, weight: 15 };
    }
    factors.reportCount.count += 1;

    const newScore = this.calculateScoreFromFactors(factors);
    const action = this.determineAction(newScore);

    spamScore.score = newScore;
    spamScore.factors = factors;
    spamScore.action = action;
    if (action !== SpamActionType.NONE) {
      spamScore.triggeredAt = new Date();
    }

    await this.spamScoresRepository.save(spamScore);

    return plainToInstance(SpamScoreResponseDto, spamScore);
  }

  /**
   * Get spam history for a user
   */
  async getSpamHistory(userId: string, limit: number = 20): Promise<SpamScoreResponseDto[]> {
    const history = await this.spamScoresRepository.findUserSpamHistory(userId, limit);
    return history.map(h => plainToInstance(SpamScoreResponseDto, h));
  }

  /**
   * Update spam score (called from queue processor)
   */
  async updateSpamScore(
    userId: string,
    newScore: number,
    factors: SpamScoreFactors,
  ): Promise<SpamScore> {
    if (newScore < 0 || newScore > 100) {
      throw new BadRequestException('Score must be between 0 and 100');
    }

    const action = this.determineAction(newScore);

    const result = await this.spamScoresRepository.upsert(
      {
        userId,
        score: newScore,
        factors,
        action,
        triggeredAt: action !== SpamActionType.NONE ? new Date() : null,
        updatedAt: new Date(),
      },
      ['userId'],
    );

    return result.generatedMaps[0] as any;
  }

  /**
   * Trigger action for high-score user (should auto-execute within 10s)
   */
  async triggerAction(spamScoreId: string): Promise<SpamScoreResponseDto> {
    const spamScore = await this.spamScoresRepository.findOne({
      where: { id: spamScoreId },
    });

    if (!spamScore) {
      throw new NotFoundException('Spam score record not found');
    }

    const action = this.determineAction(spamScore.score);

    if (action === SpamActionType.NONE) {
      throw new BadRequestException('No action to trigger - score below threshold');
    }

    // Execute action (throttle/suspend) immediately
    // In production, would call rate-limit service, etc
    spamScore.action = action;
    spamScore.triggeredAt = new Date();

    await this.spamScoresRepository.save(spamScore);

    this.logger.log(
      `Action triggered for user ${spamScore.userId}: ${action} (score: ${spamScore.score})`,
    );

    return plainToInstance(SpamScoreResponseDto, spamScore);
  }

  /**
   * Queue worker: Calculate spam factors and score for a message
   */
  async processMessageScoring(data: any): Promise<void> {
    try {
      const { messageId, content, senderId, recipientIds, ipAddress } = data;

      // Calculate factors
      const factors = await this.calculateMessageFactors(
        content,
        senderId,
        recipientIds || [],
        ipAddress,
      );

      // Get toxicity score from Perspective API (or custom model)
      const toxicityScore = await this.checkToxicity(content);
      if (toxicityScore > 0) {
        factors.toxicityScore = {
          score: toxicityScore,
          weight: 25,
        };
      }

      // Calculate final score
      const score = this.calculateScoreFromFactors(factors);

      // Update or create spam score record
      await this.updateSpamScore(senderId, score, factors);

      this.logger.debug(
        `Message ${messageId} scored: ${score} (factors: ${JSON.stringify(keys(factors))})`,
      );
    } catch (error) {
      this.logger.error(`Error scoring message: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Calculate scoring factors for a message
   */
  private async calculateMessageFactors(
    content: string,
    senderId: string,
    recipientIds: string[],
    ipAddress: string,
  ): Promise<SpamScoreFactors> {
    const factors: SpamScoreFactors = {};

    // 1. Message frequency (simplified - in production would query messages table)
    const messageCount = Math.floor(Math.random() * 50); // Placeholder
    if (messageCount > 20) {
      factors.messageFrequency = {
        count: messageCount,
        period: '1h',
        threshold: 20,
        weight: 20,
      };
    }

    // 2. Content hash (check for repeated content)
    const contentHash = this.hashContent(content);
    const duplicateCount = 0; // Would query database
    if (duplicateCount > 2) {
      factors.contentHash = {
        duplicateCount,
        consecutiveRepeats: duplicateCount > 5 ? 1 : 0,
        weight: 15,
      };
    }

    // 3. Bulk recipients detection
    if (recipientIds && recipientIds.length > 10) {
      factors.bulkRecipients = {
        recipientCount: recipientIds.length,
        threshold: 10,
        weight: 20,
      };
    }

    // 4. Account age (simplified)
    const accountAgeDays = 5; // Placeholder
    if (accountAgeDays < 7) {
      factors.accountAge = {
        ageInDays: accountAgeDays,
        threshold: 7,
        weight: 15,
      };
    }

    // 5. IP reputation (simplified)
    if (ipAddress) {
      factors.ipReputation = {
        score: 0.5, // Placeholder - would call IP reputation service
        weight: 10,
      };
    }

    return factors;
  }

  /**
   * Check content toxicity via Perspective API or custom ML model
   */
  private async checkToxicity(content: string): Promise<number> {
    try {
      const apiKey = this.configService.get('PERSPECTIVE_API_KEY');
      if (!apiKey) {
        return 0; // API not configured
      }

      const url = 'https://commentanalyzer.googleapis.com/v1/comments:analyze';
      const response = await axios.post(
        url,
        {
          comment: { text: content },
          languages: ['en'],
          requestedAttributes: {
            TOXICITY: {},
            SEVERE_TOXICITY: {},
            IDENTITY_ATTACK: {},
            INSULT: {},
            PROFANITY: {},
            THREAT: {},
          },
        },
        {
          params: { key: apiKey },
          timeout: 5000,
        },
      );

      // Average the attribute scores
      const attributes = response.data?.attributeScores || {};
      const scores = Object.values(attributes).map((attr: any) => attr.summaryScore?.value || 0);
      return scores.length > 0 ? scores.reduce((a, b) => a + b) / scores.length : 0;
    } catch (error) {
      this.logger.warn(`Error checking toxicity: ${error.message}`);
      return 0; // Graceful degradation
    }
  }

  /**
   * Calculate final spam score from weighted factors
   */
  private calculateScoreFromFactors(factors: SpamScoreFactors): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const [key, factor] of Object.entries(factors)) {
      if (this.isWeightedFactor(factor)) {
        const weight = (factor as any).weight || 0;
        let factorScore = 0;

        // Convert factor to 0-100 score based on type
        if (key === 'messageFrequency') {
          const freq = (factor as any).count || 0;
          const threshold = (factor as any).threshold || 20;
          factorScore = Math.min(100, (freq / threshold) * 100);
        } else if (key === 'contentHash') {
          const duplicates = (factor as any).duplicateCount || 0;
          factorScore = Math.min(100, duplicates * 20);
        } else if (key === 'bulkRecipients') {
          const recipientCount = (factor as any).recipientCount || 0;
          const threshold = (factor as any).threshold || 10;
          factorScore = Math.min(100, (recipientCount / threshold) * 100);
        } else if (key === 'reportCount') {
          const count = (factor as any).count || 0;
          factorScore = Math.min(100, count * 25);
        } else if (key === 'toxicityScore') {
          const score = (factor as any).score || 0;
          factorScore = score * 100; // Convert 0-1 to 0-100
        } else if (key === 'accountAge') {
          const age = (factor as any).ageInDays || 0;
          const threshold = (factor as any).threshold || 7;
          factorScore = Math.max(0, 100 - (age / threshold) * 100);
        } else if (key === 'ipReputation') {
          const score = (factor as any).score || 0;
          factorScore = score * 100;
        }

        totalScore += factorScore * (weight / 100);
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? Math.round(totalScore / (totalWeight / 100)) : 0;
  }

  /**
   * Determine action based on score
   */
  private determineAction(score: number): SpamActionType {
    if (score >= this.SUSPEND_THRESHOLD) {
      return SpamActionType.SUSPEND; // Requires admin review
    }
    if (score >= this.THROTTLE_THRESHOLD) {
      return SpamActionType.THROTTLE; // Auto-throttle
    }
    if (score >= this.WARN_THRESHOLD) {
      return SpamActionType.WARN; // Warning to user
    }
    return SpamActionType.NONE;
  }

  /**
   * Admin review: approve action or mark as false positive
   */
  async reviewSpamScore(id: string, reviewedBy: string, dto: AdminReviewDto): Promise<SpamScoreResponseDto> {
    const spamScore = await this.spamScoresRepository.findOne({ where: { id } });
    if (!spamScore) {
      throw new NotFoundException('Spam score not found');
    }

    if (dto.decision === 'reject_false_positive') {
      // Reset score to 0 and mark as false positive
      return plainToInstance(
        SpamScoreResponseDto,
        await this.spamScoresRepository.markAsReviewed(id, reviewedBy, dto.notes || '', true),
      );
    } else if (dto.decision === 'adjust' && dto.adjustedScore !== undefined) {
      // Adjust score and recalculate action
      const action = this.determineAction(dto.adjustedScore);
      const updated = await this.spamScoresRepository.create({
        ...spamScore,
        score: dto.adjustedScore,
        action,
        reviewedAt: new Date(),
        reviewedBy,
        reviewNotes: dto.notes,
      });
      await this.spamScoresRepository.save(updated);
      return plainToInstance(SpamScoreResponseDto, updated);
    } else {
      // Approve - mark reviewed but keep score/action
      return plainToInstance(
        SpamScoreResponseDto,
        await this.spamScoresRepository.markAsReviewed(id, reviewedBy, dto.notes || '', false),
      );
    }
  }

  /**
   * Get stats for spam dashboard
   */
  async getSpamStats(): Promise<any> {
    const total = await this.spamScoresRepository.count();
    const highRisk = await this.spamScoresRepository.countAboveThreshold(this.SUSPEND_THRESHOLD);
    const warned = await this.spamScoresRepository.countByAction(SpamActionType.WARN);
    const throttled = await this.spamScoresRepository.countByAction(SpamActionType.THROTTLE);
    const suspended = await this.spamScoresRepository.countByAction(SpamActionType.SUSPEND);
    const avgScore = await this.spamScoresRepository.getAverageScore();
    const actionBreakdown = await this.spamScoresRepository.getStatsByAction();

    return {
      totalUsers: total,
      highRiskUsers: highRisk,
      warnedUsers: warned,
      throttledUsers: throttled,
      suspendedUsers: suspended,
      averageScore: Math.round(avgScore * 100) / 100,
      actionBreakdown: {
        none: actionBreakdown.find((a: any) => a.action === 'none')?.count || 0,
        warn: actionBreakdown.find((a: any) => a.action === 'warn')?.count || 0,
        throttle: actionBreakdown.find((a: any) => a.action === 'throttle')?.count || 0,
        suspend: actionBreakdown.find((a: any) => a.action === 'suspend')?.count || 0,
      },
    };
  }

  /**
   * Get pending review queue
   */
  async getPendingReviewQueue(limit: number = 50): Promise<any[]> {
    const pending = await this.spamScoresRepository.findPendingReview(limit);
    return pending.map(p => ({
      id: p.id,
      userId: p.userId,
      username: p.user?.username || 'Unknown',
      score: p.score,
      action: p.action,
      factors: p.factors,
      triggeredAt: p.triggeredAt,
      daysSinceFlag: Math.floor((Date.now() - p.triggeredAt.getTime()) / (1000 * 60 * 60 * 24)),
    }));
  }

  // Helper methods
  private mapToResponseDto(data: any): SpamScoreResponseDto {
    return plainToInstance(SpamScoreResponseDto, data);
  }

  private isWeightedFactor(obj: any): boolean {
    return obj && typeof obj === 'object' && 'weight' in obj;
  }

  private hashContent(content: string): string {
    return require('crypto').createHash('sha256').update(content).digest('hex');
  }
}

// Utility function
function keys(obj: object): string[] {
  return Object.keys(obj);
}
