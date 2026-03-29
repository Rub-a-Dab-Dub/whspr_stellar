import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { DataSource, Repository } from 'typeorm';
import {
  NotificationDigest,
  DigestPeriod,
} from './entities/notification-digest.entity';
import { QuietHoursConfig } from './entities/quiet-hours-config.entity';
import { NotificationsRepository } from '../notifications/notifications.repository';
import { NotificationsGateway } from '../messaging/gateways/notifications.gateway';
import { MailService } from '../mail/mail.service';
import { User } from '../users/entities/user.entity';
import { SetQuietHoursDto, EXEMPT_NOTIFICATION_TYPES } from './dto/set-quiet-hours.dto';
import {
  QuietHoursConfigResponseDto,
  DigestSendResponseDto,
} from './dto/notification-digest-response.dto';
import { InAppNotificationType } from '../notifications/entities/notification.entity';
import { NotificationType } from '../messaging/dto/notification-events.dto';

@Injectable()
export class NotificationDigestService {
  private readonly logger = new Logger(NotificationDigestService.name);

  constructor(
    @InjectRepository(NotificationDigest)
    private readonly digestRepository: Repository<NotificationDigest>,
    @InjectRepository(QuietHoursConfig)
    private readonly quietHoursRepository: Repository<QuietHoursConfig>,
    private readonly notificationsRepository: NotificationsRepository,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly mailService: MailService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Quiet Hours Config ──────────────────────────────────────────────────────

  async getQuietHoursConfig(userId: string): Promise<QuietHoursConfigResponseDto> {
    const config = await this.findOrCreateConfig(userId);
    return this.toConfigDto(config);
  }

  async setQuietHours(
    userId: string,
    dto: SetQuietHoursDto,
  ): Promise<QuietHoursConfigResponseDto> {
    const config = await this.findOrCreateConfig(userId);

    config.isEnabled = dto.isEnabled;
    config.startTime = dto.startTime;
    config.endTime = dto.endTime;
    config.timezone = dto.timezone;
    config.exemptTypes = dto.exemptTypes ?? [...EXEMPT_NOTIFICATION_TYPES];

    const saved = await this.quietHoursRepository.save(config);
    return this.toConfigDto(saved);
  }

  /**
   * Returns true when the current wall-clock moment falls within the user's
   * configured quiet window, respecting their IANA timezone.
   */
  async isInQuietHours(userId: string): Promise<boolean> {
    const config = await this.findOrCreateConfig(userId);

    if (!config.isEnabled) return false;

    const nowInTz = this.getNowInTimezone(config.timezone);
    return this.timeIsInWindow(nowInTz, config.startTime, config.endTime);
  }

  // ─── Digest Queue & Delivery ────────────────────────────────────────────────

  /**
   * Queue a notification for the digest instead of delivering it immediately.
   * Creates or appends to the pending hourly digest for the user.
   */
  async queueForDigest(userId: string, notificationId: string): Promise<void> {
    const now = new Date();
    // Find open (unsent) digest for this user
    let digest = await this.digestRepository.findOne({
      where: { userId, summarySent: false, period: DigestPeriod.HOURLY },
      order: { createdAt: 'DESC' },
    });

    if (!digest) {
      // Create a new digest slot scheduled 1 hour from now
      const scheduledFor = new Date(now.getTime() + 60 * 60 * 1000);
      digest = this.digestRepository.create({
        userId,
        period: DigestPeriod.HOURLY,
        notificationIds: [notificationId],
        summarySent: false,
        scheduledFor,
        sentAt: null,
      });
    } else {
      if (!digest.notificationIds) digest.notificationIds = [];
      if (!digest.notificationIds.includes(notificationId)) {
        digest.notificationIds = [...digest.notificationIds, notificationId];
      }
    }

    await this.digestRepository.save(digest);
    this.logger.debug(
      `Queued notification ${notificationId} into digest for user ${userId}`,
    );
  }

  /**
   * Immediately send the pending digest for a user and mark it as sent.
   * Used by flushOnWakeup and the manual "send-now" endpoint.
   */
  async sendDigest(userId: string): Promise<DigestSendResponseDto> {
    const digest = await this.digestRepository.findOne({
      where: { userId, summarySent: false },
      order: { createdAt: 'DESC' },
    });

    if (!digest || !digest.notificationIds?.length) {
      throw new NotFoundException('No pending digest found for user');
    }

    return this.deliverDigest(digest);
  }

  /**
   * Called when a user's quiet-hours window ends.
   * Sends the accumulated digest for every user whose quiet window just ended.
   */
  async flushOnWakeup(): Promise<void> {
    // Find all users who have a pending digest
    const pendingDigests = await this.digestRepository.find({
      where: { summarySent: false },
    });

    const userIds = [...new Set(pendingDigests.map((d) => d.userId))];

    for (const userId of userIds) {
      const isInQH = await this.isInQuietHours(userId);
      if (!isInQH) {
        // Quiet hours just ended – flush
        const userDigests = pendingDigests.filter(
          (d: NotificationDigest) => d.userId === userId && d.notificationIds?.length,
        );
        for (const d of userDigests) {
          try {
            await this.deliverDigest(d);
          } catch (err) {
            this.logger.error(`Failed to flush digest ${d.id} for user ${userId}`, err);
          }
        }
      }
    }
  }

  // ─── Cron Scheduler ─────────────────────────────────────────────────────────

  /**
   * Runs every hour. Delivers all digests whose scheduledFor time has passed.
   */
  @Cron('0 * * * *')
  async runHourlyDigestScheduler(): Promise<void> {
    this.logger.log('Running hourly digest scheduler…');
    const now = new Date();

    const due = await this.dataSource
      .getRepository(NotificationDigest)
      .createQueryBuilder('d')
      .where('d.summarySent = false')
      .andWhere('d.scheduledFor <= :now', { now })
      .andWhere("array_length(d.notificationIds, 1) > 0")
      .getMany();

    this.logger.log(`Found ${due.length} due digests`);

    for (const digest of due) {
      try {
        await this.deliverDigest(digest);
      } catch (err) {
        this.logger.error(`Failed to deliver digest ${digest.id}`, err);
      }
    }

    // Also check for users whose quiet hours have ended
    await this.flushOnWakeup();
  }

  // ─── Quiet-Hours Gate (used by NotificationsService) ────────────────────────

  /**
   * Checks if a notification type is exempt from quiet hours.
   */
  isExemptType(type: InAppNotificationType, exemptTypes: string[]): boolean {
    return exemptTypes.includes(type as string);
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private async deliverDigest(digest: NotificationDigest): Promise<DigestSendResponseDto> {
    const notificationIds = digest.notificationIds ?? [];
    const userId = digest.userId;

    // Fetch notification records for the digest
    const notifications = await Promise.allSettled(
      notificationIds.map((id) =>
        this.notificationsRepository.findByIdForUser(id, userId),
      ),
    );

    const valid = notifications
      .filter((r) => r.status === 'fulfilled' && r.value)
      .map((r) => (r as PromiseFulfilledResult<any>).value!);

    if (valid.length === 0) {
      // Mark empty digest as sent so it doesn't loop
      digest.summarySent = true;
      digest.sentAt = new Date();
      await this.digestRepository.save(digest);
      throw new NotFoundException('No valid notifications found in digest');
    }

    // Build grouped summary
    const grouped = this.groupByType(valid);
    const summaryText = this.buildSummaryText(grouped);

    // Push single WebSocket summary notification
    await this.notificationsGateway.sendNotification(userId, {
      id: digest.id,
      type: NotificationType.NEW_MESSAGE, // generic digest type
      title: `📋 Notification Digest (${valid.length} missed)`,
      body: summaryText,
      data: { digestId: digest.id, count: valid.length },
    });

    // Send digest email if user has an email address
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (user?.email) {
        await this.mailService.sendDigestEmail(user.email, grouped, valid.length);
      }
    } catch (err) {
      this.logger.error(`Failed to send digest email for user ${userId}`, err);
    }

    // Mark digest as sent
    digest.summarySent = true;
    digest.sentAt = new Date();
    await this.digestRepository.save(digest);

    const sentAt = digest.sentAt!;
    return {
      digestId: digest.id,
      notificationCount: valid.length,
      sentAt,
    };
  }

  private groupByType(notifications: any[]): Record<string, any[]> {
    return notifications.reduce(
      (acc, n) => {
        const key: string = n.type ?? 'OTHER';
        if (!acc[key]) acc[key] = [];
        acc[key].push(n);
        return acc;
      },
      {} as Record<string, any[]>,
    );
  }

  private buildSummaryText(grouped: Record<string, any[]>): string {
    return Object.entries(grouped)
      .map(([type, items]) => `${type.replace(/_/g, ' ')}: ${items.length}`)
      .join(' · ');
  }

  private async findOrCreateConfig(userId: string): Promise<QuietHoursConfig> {
    let config = await this.quietHoursRepository.findOne({ where: { userId } });
    if (!config) {
      config = this.quietHoursRepository.create({
        userId,
        isEnabled: false,
        startTime: '22:00',
        endTime: '08:00',
        timezone: 'UTC',
        exemptTypes: [...EXEMPT_NOTIFICATION_TYPES],
      });
      await this.quietHoursRepository.save(config);
    }
    return config;
  }

  /**
   * Get current time in user's timezone as HH:MM string.
   */
  private getNowInTimezone(tz: string): string {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date());
    } catch {
      // Fallback to UTC if invalid timezone
      return new Date().toISOString().substring(11, 16);
    }
  }

  /**
   * Checks if a given HH:MM time falls within the start–end window.
   * Supports overnight windows (e.g. 22:00 – 08:00).
   */
  private timeIsInWindow(current: string, start: string, end: string): boolean {
    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const cur = toMinutes(current);
    const s = toMinutes(start);
    const e = toMinutes(end);

    if (s <= e) {
      // Normal window: e.g. 09:00 – 17:00
      return cur >= s && cur < e;
    } else {
      // Overnight window: e.g. 22:00 – 08:00
      return cur >= s || cur < e;
    }
  }

  private toConfigDto(config: QuietHoursConfig): QuietHoursConfigResponseDto {
    return {
      userId: config.userId,
      isEnabled: config.isEnabled,
      startTime: config.startTime,
      endTime: config.endTime,
      timezone: config.timezone,
      exemptTypes: config.exemptTypes ?? [...EXEMPT_NOTIFICATION_TYPES],
      updatedAt: config.updatedAt,
    };
  }
}
