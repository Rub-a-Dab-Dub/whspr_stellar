import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { BadgeKey } from './entities/badge.entity';
import { UserBadge } from './entities/user-badge.entity';
import { BadgeRepository } from './badge.repository';
import { UserBadgeRepository } from './user-badge.repository';
import { BadgeResponseDto, UserBadgeResponseDto } from './dto/badge.dto';
import { BADGE_DEFINITIONS } from './badge-seed';
import { NotificationsService } from '../notifications/notifications.service';
import { InAppNotificationType } from '../notifications/entities/notification.entity';

@Injectable()
export class BadgesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BadgesService.name);

  constructor(
    private readonly badgeRepo: BadgeRepository,
    private readonly userBadgeRepo: UserBadgeRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Seed canonical badge definitions on startup. */
  async onApplicationBootstrap(): Promise<void> {
    await this.seed();
  }

  async seed(): Promise<void> {
    for (const def of BADGE_DEFINITIONS) {
      await this.badgeRepo.upsert(def);
    }
    this.logger.log('Badge definitions seeded');
  }

  // ── Public reads ───────────────────────────────────────────────────────────

  async findAll(): Promise<BadgeResponseDto[]> {
    const badges = await this.badgeRepo.findAll();
    return badges.map((b) => this.toBadgeDto(b));
  }

  async findForUser(userId: string): Promise<UserBadgeResponseDto[]> {
    const ubs = await this.userBadgeRepo.findByUser(userId);
    return ubs.map((ub) => this.toUserBadgeDto(ub));
  }

  // ── Award ──────────────────────────────────────────────────────────────────

  async awardBadge(userId: string, key: BadgeKey): Promise<UserBadgeResponseDto | null> {
    const badge = await this.badgeRepo.findByKey(key);
    if (!badge) {
      this.logger.warn(`Badge key ${key} not found — skipping award`);
      return null;
    }

    const awarded = await this.userBadgeRepo.award(userId, badge.id);
    if (!awarded) {
      return null; // already had it
    }

    // Reload with relation
    const full = await this.userBadgeRepo.findByUserAndBadge(userId, badge.id);
    if (!full) return null;

    // Fire-and-forget in-app notification
    this.notificationsService
      .createNotification({
        userId,
        type: InAppNotificationType.TRANSACTION_CONFIRMED, // reuse closest type
        title: `Badge Unlocked: ${badge.name}`,
        body: badge.description,
        data: { badgeId: badge.id, badgeKey: badge.key },
      })
      .catch((err) => this.logger.error('Failed to send badge notification', err));

    this.logger.log(`Awarded badge ${key} to user ${userId}`);
    return this.toUserBadgeDto(full);
  }

  // ── Display selection ──────────────────────────────────────────────────────

  async updateDisplayedBadges(userId: string, badgeIds: string[]): Promise<UserBadgeResponseDto[]> {
    if (badgeIds.length > 3) {
      throw new BadRequestException('You can display at most 3 badges');
    }

    // Verify all badgeIds belong to this user
    for (const badgeId of badgeIds) {
      const ub = await this.userBadgeRepo.findByUserAndBadge(userId, badgeId);
      if (!ub) {
        throw new NotFoundException(`Badge ${badgeId} not found in your collection`);
      }
    }

    await this.userBadgeRepo.updateDisplayed(userId, badgeIds);
    return this.findForUser(userId);
  }

  // ── Event-driven award triggers ────────────────────────────────────────────

  async onTransferCompleted(userId: string, amount: number): Promise<void> {
    await this.awardBadge(userId, BadgeKey.FIRST_TRANSFER);
    if (amount >= 10_000) {
      await this.awardBadge(userId, BadgeKey.CRYPTO_WHALE);
    }
  }

  async onReferralCompleted(referrerId: string, totalReferrals: number): Promise<void> {
    if (totalReferrals >= 5) {
      await this.awardBadge(referrerId, BadgeKey.TOP_REFERRER);
    }
  }

  async onMessageSent(userId: string, totalMessages: number): Promise<void> {
    if (totalMessages >= 100) {
      await this.awardBadge(userId, BadgeKey.CHAT_CHAMPION);
    }
  }

  async onDaoVoteCast(userId: string): Promise<void> {
    await this.awardBadge(userId, BadgeKey.DAO_VOTER);
  }

  async onGroupCreated(userId: string): Promise<void> {
    await this.awardBadge(userId, BadgeKey.GROUP_FOUNDER);
  }

  async onUserRegistered(userId: string, registeredAt: Date): Promise<void> {
    const cutoff = new Date('2025-01-01T00:00:00.000Z');
    if (registeredAt < cutoff) {
      await this.awardBadge(userId, BadgeKey.EARLY_ADOPTER);
    }
  }

  // ── Mappers ────────────────────────────────────────────────────────────────

  private toBadgeDto(b: any): BadgeResponseDto {
    return {
      id: b.id,
      key: b.key,
      name: b.name,
      description: b.description,
      iconUrl: b.iconUrl,
      tier: b.tier,
      criteria: b.criteria,
      createdAt: b.createdAt,
    };
  }

  private toUserBadgeDto(ub: UserBadge): UserBadgeResponseDto {
    return {
      id: ub.id,
      userId: ub.userId,
      badgeId: ub.badgeId,
      badge: this.toBadgeDto(ub.badge),
      isDisplayed: ub.isDisplayed,
      awardedAt: ub.awardedAt,
    };
  }
}
