import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { WaitlistRepository } from './waitlist.repository';
import { WaitlistGateway } from './waitlist.gateway';
import { MailService } from '../mail/mail.service';
import { WaitlistEntry } from './entities/waitlist-entry.entity';
import { nanoid } from 'nanoid';

export const POINTS = {
  JOIN: 10,
  REFERRAL: 25,
  SOCIAL_SHARE: 50,
} as const;

const MAX_REFERRAL_DEPTH = 3;
const MAX_SIGNUPS_PER_IP_PER_HOUR = 5;

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  const masked = local.slice(0, 2) + '***';
  return `${masked}@${domain}`;
}

@Injectable()
export class WaitlistService {
  constructor(
    private readonly repo: WaitlistRepository,
    private readonly gateway: WaitlistGateway,
    private readonly mail: MailService,
  ) {}

  // ─── Join ────────────────────────────────────────────────────────────────

  async joinWaitlist(
    email: string,
    referralCode?: string,
    ip?: string,
  ): Promise<WaitlistEntry> {
    // Fraud check 1: duplicate email
    const existing = await this.repo.findByEmail(email);
    if (existing) {
      throw new ConflictException('This email is already on the waitlist');
    }

    // Fraud check 2: IP burst (max 5 signups per IP per hour)
    if (ip) {
      const recentCount = await this.repo.countByIpInLastHour(ip);
      if (recentCount >= MAX_SIGNUPS_PER_IP_PER_HOUR) {
        throw new BadRequestException(
          'Too many signups from this IP address. Try again later.',
        );
      }
    }

    // Create entry with 10 join points
    const entry = await this.repo.save({
      email,
      referralCode: nanoid(10), // e.g. "V1StGXR8_Z"
      points: POINTS.JOIN,
      ipAddress: ip ?? null,
      referralDepth: 1,
    });

    // Apply referral if a code was provided
    if (referralCode) {
      await this._applyReferral(entry, referralCode);
    }

    // Recalculate all positions and push live leaderboard
    await this.repo.recalculatePositions();
    await this._pushLeaderboard();

    // Fetch updated entry (position now set)
    const updated = await this.repo.findById(entry.id);

    // Send confirmation email (non-blocking)
    this.mail
      .sendWaitlistConfirmation(email, updated.referralCode, updated.position)
      .catch(() => null);

    return updated;
  }

  // ─── Referral ────────────────────────────────────────────────────────────

  private async _applyReferral(
    newEntry: WaitlistEntry,
    referralCode: string,
  ): Promise<void> {
    const referrer = await this.repo.findByReferralCode(referralCode);

    if (!referrer) return; // silently skip invalid codes
    if (referrer.id === newEntry.id) return; // can't refer yourself
    if (referrer.referralDepth >= MAX_REFERRAL_DEPTH) return; // depth limit

    // Link the new entry to its referrer
    await this.repo.save({
      id: newEntry.id,
      referredBy: referralCode,
      referralDepth: referrer.referralDepth + 1,
    });

    // Award the referrer 25 points
    await this.repo.addPoints(referrer.id, POINTS.REFERRAL);
  }

  // ─── Position ────────────────────────────────────────────────────────────

  async getPosition(email: string) {
    const entry = await this.repo.findByEmail(email);
    if (!entry) {
      throw new NotFoundException('Email not found on waitlist');
    }

    return {
      email: entry.email,
      position: entry.position,
      points: entry.points,
      referralCode: entry.referralCode,
      joinedAt: entry.joinedAt,
    };
  }

  // ─── Leaderboard ─────────────────────────────────────────────────────────

  async getLeaderboard() {
    const entries = await this.repo.getLeaderboard(100);
    return entries.map((e) => ({
      position: e.position,
      email: maskEmail(e.email),
      points: e.points,
      joinedAt: e.joinedAt,
    }));
  }

  // ─── Points ──────────────────────────────────────────────────────────────

  async awardSocialShare(email: string) {
    const entry = await this.repo.findByEmail(email);
    if (!entry) {
      throw new NotFoundException('Email not found on waitlist');
    }

    await this.repo.addPoints(entry.id, POINTS.SOCIAL_SHARE);
    await this.repo.recalculatePositions();
    await this._pushLeaderboard();

    return {
      message: 'Social share points awarded',
      pointsAwarded: POINTS.SOCIAL_SHARE,
    };
  }

  // ─── Convert ─────────────────────────────────────────────────────────────

  async convertToUser(email: string) {
    const entry = await this.repo.findByEmail(email);
    if (!entry) {
      throw new NotFoundException('Email not found on waitlist');
    }
    if (entry.isConverted) {
      throw new ConflictException('User already converted');
    }

    await this.repo.markConverted(entry.id);
    await this.repo.recalculatePositions();
    await this._pushLeaderboard();

    return { converted: true, email };
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  private async _pushLeaderboard(): Promise<void> {
    const board = await this.getLeaderboard();
    this.gateway.emitLeaderboardUpdate(board);
  }
}