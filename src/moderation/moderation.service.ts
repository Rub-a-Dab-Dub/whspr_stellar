import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ModerationRule } from './entities/moderation-rule.entity';
import { ModerationAction, ModerationActionType, ModerationReason } from './entities/moderation-action.entity';
import { ModerationWarning } from './entities/moderation-warning.entity';
import { RoomModerationSettings } from './entities/room-moderation-settings.entity';
import { FlaggedMessage, FlagStatus } from './entities/flagged-message.entity';
import { ProfanityFilterService } from './services/profanity-filter.service';
import { SpamDetectionService } from './services/spam-detection.service';
import { RateLimiterService } from './services/rate-limiter.service';

export interface ModerationResult {
  allowed: boolean;
  reason?: string;
  action?: ModerationActionType;
  filteredContent?: string;
}

@Injectable()
export class ModerationService {
  constructor(
    @InjectRepository(ModerationRule)
    private ruleRepo: Repository<ModerationRule>,
    @InjectRepository(ModerationAction)
    private actionRepo: Repository<ModerationAction>,
    @InjectRepository(ModerationWarning)
    private warningRepo: Repository<ModerationWarning>,
    @InjectRepository(RoomModerationSettings)
    private settingsRepo: Repository<RoomModerationSettings>,
    @InjectRepository(FlaggedMessage)
    private flaggedRepo: Repository<FlaggedMessage>,
    private profanityFilter: ProfanityFilterService,
    private spamDetection: SpamDetectionService,
    private rateLimiter: RateLimiterService,
  ) {}

  /**
   * Main moderation check for messages
   */
  async moderateMessage(
    content: string,
    userId: string,
    roomId: string
  ): Promise<ModerationResult> {
    const settings = await this.getOrCreateSettings(roomId);

    // 1. Check rate limit
    const rateLimitCheck = await this.rateLimiter.checkRateLimit(
      userId,
      roomId,
      {
        maxMessages: settings.maxMessagesPerMinute,
        windowMs: 60000, // 1 minute
      }
    );

    if (rateLimitCheck.limited) {
      await this.handleViolation(
        userId,
        roomId,
        null,
        ModerationReason.RATE_LIMIT,
        'Rate limit exceeded'
      );
      return {
        allowed: false,
        reason: 'Rate limit exceeded. Please slow down.',
      };
    }

    // 2. Check profanity
    if (settings.profanityFilterEnabled) {
      const isProfane = this.profanityFilter.isProfane(
        content,
        settings.blacklistedWords
      );

      if (isProfane) {
        const cleaned = this.profanityFilter.clean(content, settings.blacklistedWords);
        await this.handleViolation(
          userId,
          roomId,
          null,
          ModerationReason.PROFANITY,
          'Profanity detected'
        );
        
        // Auto-flag the message
        await this.flagMessage({
          messageId: null, // will be set by caller
          roomId,
          userId,
          content,
          reason: 'Automatic: Profanity detected',
          reportedBy: 'system',
        });

        return {
          allowed: false,
          reason: 'Message contains inappropriate language',
          filteredContent: cleaned,
        };
      }
    }

    // 3. Check spam
    if (settings.spamDetectionEnabled) {
      const isSpam = this.spamDetection.isSpam(content, settings.spamThreshold);

      if (isSpam) {
        await this.handleViolation(
          userId,
          roomId,
          null,
          ModerationReason.SPAM,
          'Spam detected'
        );
        return {
          allowed: false,
          reason: 'Message detected as spam',
        };
      }
    }

    // 4. Check link spam
    if (settings.linkSpamDetectionEnabled) {
      const isLinkSpam = this.spamDetection.isLinkSpam(
        content,
        settings.whitelistedDomains
      );

      if (isLinkSpam) {
        await this.handleViolation(
          userId,
          roomId,
          null,
          ModerationReason.LINK_SPAM,
          'Link spam detected'
        );
        return {
          allowed: false,
          reason: 'Suspicious links detected',
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Handle moderation violation
   */
  private async handleViolation(
    userId: string,
    roomId: string,
    messageId: string | null,
    reason: ModerationReason,
    details: string
  ): Promise<void> {
    const settings = await this.getOrCreateSettings(roomId);

    // Get or create warning record
    let warning = await this.warningRepo.findOne({
      where: { userId, roomId },
    });

    if (!warning) {
      warning = this.warningRepo.create({
        userId,
        roomId,
        reason: details,
        count: 1,
        lastWarningAt: new Date(),
      });
    } else {
      warning.count += 1;
      warning.lastWarningAt = new Date();
      warning.reason = details;
    }

    await this.warningRepo.save(warning);

    // Create warning action
    await this.actionRepo.save({
      userId,
      roomId,
      messageId,
      actionType: ModerationActionType.WARN,
      reason,
      details,
      isAutomated: true,
    });

    // Check if auto-mute should be triggered
    if (warning.count >= settings.maxWarningsBeforeMute) {
      await this.autoMuteUser(userId, roomId, settings.autoMuteDuration);
    }
  }

  /**
   * Auto-mute user
   */
  private async autoMuteUser(
    userId: string,
    roomId: string,
    durationMinutes: number
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + durationMinutes * 60000);

    await this.actionRepo.save({
      userId,
      roomId,
      actionType: ModerationActionType.MUTE,
      reason: ModerationReason.MANUAL,
      details: `Auto-muted for ${durationMinutes} minutes after multiple violations`,
      isAutomated: true,
      expiresAt,
    });
  }

  /**
   * Check if user is muted
   */
  async isUserMuted(userId: string, roomId: string): Promise<boolean> {
    const muteAction = await this.actionRepo.findOne({
      where: {
        userId,
        roomId,
        actionType: ModerationActionType.MUTE,
        expiresAt: LessThan(new Date()),
      },
      order: { createdAt: 'DESC' },
    });

    return !!muteAction && new Date() < muteAction.expiresAt;
  }

  /**
   * Manual message reporting
   */
  async reportMessage(data: {
    messageId: string;
    roomId: string;
    userId: string;
    content: string;
    reason: string;
    reportedBy: string;
  }): Promise<FlaggedMessage> {
    const flagged = this.flaggedRepo.create({
      ...data,
      status: FlagStatus.PENDING,
    });

    return await this.flaggedRepo.save(flagged);
  }

  /**
   * Flag message (auto or manual)
   */
  private async flagMessage(data: {
    messageId: string | null;
    roomId: string;
    userId: string;
    content: string;
    reason: string;
    reportedBy: string;
  }): Promise<FlaggedMessage> {
    const flagged = this.flaggedRepo.create({
      ...data,
      status: FlagStatus.PENDING,
    });

    return await this.flaggedRepo.save(flagged);
  }

  /**
   * Get moderator review queue
   */
  async getReviewQueue(roomId?: string): Promise<FlaggedMessage[]> {
    const where: any = { status: FlagStatus.PENDING };
    if (roomId) where.roomId = roomId;

    return await this.flaggedRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Review flagged message
   */
  async reviewFlaggedMessage(
    flaggedId: string,
    reviewerId: string,
    approved: boolean,
    notes?: string
  ): Promise<FlaggedMessage> {
    const flagged = await this.flaggedRepo.findOne({
      where: { id: flaggedId },
    });

    if (!flagged) {
      throw new NotFoundException('Flagged message not found');
    }

    flagged.status = approved ? FlagStatus.AUTO_REMOVED : FlagStatus.REJECTED;
    flagged.reviewedBy = reviewerId;
    flagged.moderatorNotes = notes;

    return await this.flaggedRepo.save(flagged);
  }

  /**
   * Get or create room moderation settings
   */
  private async getOrCreateSettings(
    roomId: string
  ): Promise<RoomModerationSettings> {
    let settings = await this.settingsRepo.findOne({ where: { roomId } });

    if (!settings) {
      settings = this.settingsRepo.create({ roomId });
      await this.settingsRepo.save(settings);
    }

    return settings;
  }

  /**
   * Update room moderation settings
   */
  async updateSettings(
    roomId: string,
    updates: Partial<RoomModerationSettings>
  ): Promise<RoomModerationSettings> {
    const settings = await this.getOrCreateSettings(roomId);
    Object.assign(settings, updates);
    return await this.settingsRepo.save(settings);
  }

  /**
   * Get moderation actions for user
   */
  async getUserActions(userId: string, roomId?: string): Promise<ModerationAction[]> {
    const where: any = { userId };
    if (roomId) where.roomId = roomId;

    return await this.actionRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  /**
   * Clear old moderation actions (cleanup job)
   */
  async cleanupExpiredActions(): Promise<void> {
    await this.actionRepo.delete({
      expiresAt: LessThan(new Date()),
    });
  }
}