import {
  Injectable,
  Logger,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { FraudDetectionRepository } from './fraud-detection.repository';
import { GeoProvider, GeoData } from './geo/geo.provider';
import { MailService } from '../mail/mail.service';
import { LoginAttempt } from './entities/login-attempt.entity';
import { LoginAction } from './enums/login-action.enum';

const BLOCKED_IP_KEY = (ip: string) => `fraud:blocked:${ip}`;
const GEO_CACHE_KEY = (ip: string) => `fraud:geo:${ip}`;
const GEO_CACHE_TTL = 60 * 60 * 1000; // 1 hour ms

const RISK_WEIGHTS = {
  VPN: 30,
  TOR: 50,
  NEW_COUNTRY: 25,
  RAPID_IP_SWITCH: 20,
  REPEATED_BLOCKS: 20,
} as const;

const HIGH_RISK_THRESHOLD = 70;

export interface LoginAnalysisResult {
  attempt: LoginAttempt;
  riskScore: number;
  action: LoginAction;
  requiresMfa: boolean;
  isBlocked: boolean;
}

@Injectable()
export class FraudDetectionService {
  private readonly logger = new Logger(FraudDetectionService.name);

  constructor(
    private readonly repo: FraudDetectionRepository,
    private readonly geo: GeoProvider,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  // ─── Core ─────────────────────────────────────────────────────────────

  async analyzeLogin(
    ipAddress: string,
    userId?: string,
    userAgent?: string,
    userEmail?: string,
  ): Promise<LoginAnalysisResult> {
    // Instant block check
    const blocked = await this.isIPBlocked(ipAddress);
    if (blocked) {
      const attempt = await this.repo.save({
        userId,
        ipAddress,
        userAgent,
        riskScore: 100,
        action: LoginAction.BLOCKED,
        isSuspicious: true,
        flagReason: 'IP is on the block list',
        country: 'Unknown',
        city: 'Unknown',
      });
      return { attempt, riskScore: 100, action: LoginAction.BLOCKED, requiresMfa: false, isBlocked: true };
    }

    // Geo lookup (cached)
    const geoData = await this._getCachedGeo(ipAddress);

    // Risk score
    const { riskScore, reasons } = await this._computeRiskScore(ipAddress, userId, geoData);

    // Action
    const action = this._determineAction(riskScore);

    // Persist
    const attempt = await this.repo.save({
      userId,
      ipAddress,
      userAgent,
      country: geoData?.country ?? 'Unknown',
      city: geoData?.city ?? 'Unknown',
      region: geoData?.region ?? 'Unknown',
      isp: geoData?.isp ?? 'Unknown',
      isVPN: geoData?.isProxy ?? false,
      isTor: geoData?.isTor ?? false,
      isSuspicious: riskScore >= HIGH_RISK_THRESHOLD,
      riskScore,
      action,
      flagReason: reasons.length ? reasons.join('; ') : null,
    });

    // High-risk side-effects (non-blocking)
    if (riskScore >= HIGH_RISK_THRESHOLD && userEmail) {
      this._sendSecurityAlert(attempt, userEmail, reasons, geoData).catch(
        (err) => this.logger.error('Security alert failed', err),
      );
    }

    return {
      attempt,
      riskScore,
      action,
      requiresMfa: action === LoginAction.CHALLENGED,
      isBlocked: false,
    };
  }

  // ─── Risk score ────────────────────────────────────────────────────────

  async getRiskScore(
    ipAddress: string,
    userId?: string,
  ): Promise<{ score: number; reasons: string[] }> {
    const geoData = await this._getCachedGeo(ipAddress);
    const { riskScore, reasons } = await this._computeRiskScore(ipAddress, userId, geoData);
    return { score: riskScore, reasons };
  }

  private async _computeRiskScore(
    ipAddress: string,
    userId: string | undefined,
    geoData: GeoData | null,
  ): Promise<{ riskScore: number; reasons: string[] }> {
    let score = 0;
    const reasons: string[] = [];

    if (geoData?.isProxy) {
      score += RISK_WEIGHTS.VPN;
      reasons.push('VPN or proxy detected');
    }

    if (geoData?.isTor) {
      score += RISK_WEIGHTS.TOR;
      reasons.push('Tor exit node detected');
    }

    if (userId) {
      // New country detection
      const lastCountry = await this.repo.getLastKnownCountry(userId);
      const currentCountry = geoData?.country;
      if (
        lastCountry &&
        currentCountry &&
        lastCountry !== currentCountry &&
        lastCountry !== 'Local' &&
        lastCountry !== 'Unknown'
      ) {
        score += RISK_WEIGHTS.NEW_COUNTRY;
        reasons.push(`New country login: ${currentCountry} (was: ${lastCountry})`);
      }

      // Rapid IP switching — 3+ distinct IPs in 10 minutes
      const recentIPs = await this.repo.getRecentIPs(userId, 10, 10);
      const uniqueOtherIPs = recentIPs.filter((ip) => ip !== ipAddress);
      if (uniqueOtherIPs.length >= 3) {
        score += RISK_WEIGHTS.RAPID_IP_SWITCH;
        reasons.push(`Rapid IP switching: ${uniqueOtherIPs.length + 1} IPs in 10 min`);
      }

      // Repeated blocked attempts
      const recentBlocks = await this.repo.countRecentFailedAttempts(userId, 30);
      if (recentBlocks >= 3) {
        score += RISK_WEIGHTS.REPEATED_BLOCKS;
        reasons.push(`${recentBlocks} blocked attempts in last 30 min`);
      }
    }

    return { riskScore: Math.min(score, 100), reasons };
  }

  private _determineAction(riskScore: number): LoginAction {
    if (riskScore >= 90) return LoginAction.BLOCKED;
    if (riskScore >= HIGH_RISK_THRESHOLD) return LoginAction.CHALLENGED;
    return LoginAction.ALLOWED;
  }

  // ─── Flagging ──────────────────────────────────────────────────────────

  async flagSuspiciousActivity(attemptId: string, reason: string): Promise<void> {
    await this.repo.save({ id: attemptId, isSuspicious: true, flagReason: reason } as Partial<LoginAttempt>);
  }

  // ─── History ───────────────────────────────────────────────────────────

  async getLoginHistory(userId?: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const [data, total] = userId
      ? await this.repo.findByUser(userId, limit, offset)
      : await this.repo.findAll(limit, offset);
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  // ─── IP blocking ───────────────────────────────────────────────────────

  async blockIP(ipAddress: string, reason = 'Manual block'): Promise<void> {
    await this.cache.set(
      BLOCKED_IP_KEY(ipAddress),
      { reason, blockedAt: new Date().toISOString() },
      0,
    );
    this.logger.warn(`IP blocked: ${ipAddress} — ${reason}`);
  }

  async unblockIP(ipAddress: string): Promise<void> {
    const exists = await this.cache.get(BLOCKED_IP_KEY(ipAddress));
    if (!exists) throw new NotFoundException(`IP ${ipAddress} is not blocked`);
    await this.cache.del(BLOCKED_IP_KEY(ipAddress));
    this.logger.log(`IP unblocked: ${ipAddress}`);
  }

  async isIPBlocked(ipAddress: string): Promise<boolean> {
    const val = await this.cache.get(BLOCKED_IP_KEY(ipAddress));
    return val !== null && val !== undefined;
  }

  async getBlockedIPs(): Promise<{ ip: string; reason: string; blockedAt: string }[]> {
    try {
      const store = (this.cache as any).store;
      const keys: string[] = await store.keys('fraud:blocked:*');
      return Promise.all(
        keys.map(async (key) => {
          const data = await this.cache.get<{ reason: string; blockedAt: string }>(key);
          return {
            ip: key.replace('fraud:blocked:', ''),
            reason: data?.reason ?? 'Unknown',
            blockedAt: data?.blockedAt ?? '',
          };
        }),
      );
    } catch {
      return [];
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private async _getCachedGeo(ip: string): Promise<GeoData | null> {
    const key = GEO_CACHE_KEY(ip);
    const cached = await this.cache.get<GeoData>(key);
    if (cached) return cached;

    const data = await this.geo.lookup(ip);
    if (data) await this.cache.set(key, data, GEO_CACHE_TTL);
    return data;
  }

  private async _sendSecurityAlert(
    attempt: LoginAttempt,
    userEmail: string,
    reasons: string[],
    geoData: GeoData | null,
  ): Promise<void> {
    const blockVpn = this.config.get<string>('FRAUD_BLOCK_VPN', 'false') === 'true';
    const isNewCountry = reasons.some((r) => r.includes('New country'));

    if (isNewCountry || geoData?.isTor || (geoData?.isProxy && blockVpn)) {
      await this.mail.sendSecurityAlert(userEmail, {
        ipAddress: attempt.ipAddress,
        country: attempt.country,
        city: attempt.city,
        riskScore: attempt.riskScore,
        reasons,
        action: attempt.action,
        timestamp: attempt.createdAt,
      });
    }
  }
}