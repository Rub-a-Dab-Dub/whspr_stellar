import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { Redis } from 'ioredis';
import { CacheService } from '../../cache/cache.service';
import { GeoService } from '../geo.service';
import { LoginAttempt, LoginAction } from '../entities/login-attempt.entity';

const BLOCKED_IP_KEY = 'fraud:blocked-ips';
const RAPID_IP_WINDOW_SECONDS = 300; // 5 min
const RAPID_IP_THRESHOLD = 3;        // distinct IPs in window → suspicious

export interface AnalyzeLoginInput {
  userId: string | null;
  ipAddress: string;
  twoFaEnabled?: boolean;
}

export interface AnalyzeLoginResult {
  action: LoginAction;
  riskScore: number;
  requiresTwoFa: boolean;
  attempt: LoginAttempt;
}

@Injectable()
export class FraudDetectionService {
  private readonly logger = new Logger(FraudDetectionService.name);

  constructor(
    @InjectRepository(LoginAttempt)
    private readonly loginRepo: Repository<LoginAttempt>,
    private readonly cache: CacheService,
    private readonly geo: GeoService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  // ─── Core analysis ────────────────────────────────────────────────────────

  async analyzeLogin(input: AnalyzeLoginInput): Promise<AnalyzeLoginResult> {
    const { userId, ipAddress, twoFaEnabled = false } = input;

    // 1. Blocked IP check (Redis set — instant across all instances)
    if (await this.isBlocked(ipAddress)) {
      const attempt = await this.saveAttempt({
        userId,
        ipAddress,
        country: null,
        countryCode: null,
        city: null,
        isVPN: false,
        isTor: false,
        isSuspicious: true,
        riskScore: 100,
        action: LoginAction.BLOCKED,
      });
      return { action: LoginAction.BLOCKED, riskScore: 100, requiresTwoFa: false, attempt };
    }

    // 2. Geo lookup (cached 1 h)
    const geo = await this.geo.lookup(ipAddress);

    // 3. Compute risk score
    const riskScore = await this.getRiskScore({ userId, ipAddress, geo });

    // 4. Determine action
    const isSuspicious = riskScore > 50;
    const requiresTwoFa = twoFaEnabled && riskScore > 70;
    const action =
      riskScore >= 90
        ? LoginAction.BLOCKED
        : requiresTwoFa
          ? LoginAction.CHALLENGED
          : LoginAction.ALLOWED;

    const attempt = await this.saveAttempt({
      userId,
      ipAddress,
      country: geo.country,
      countryCode: geo.countryCode,
      city: geo.city,
      isVPN: geo.isProxy,
      isTor: geo.isTor,
      isSuspicious,
      riskScore,
      action,
    });

    if (isSuspicious) {
      this.flagSuspiciousActivity(attempt);
    }

    return { action, riskScore, requiresTwoFa, attempt };
  }

  async getRiskScore(params: {
    userId: string | null;
    ipAddress: string;
    geo: { country: string | null; countryCode: string | null; isProxy: boolean; isTor: boolean };
  }): Promise<number> {
    let score = 0;

    // VPN / proxy
    if (params.geo.isProxy) score += 30;
    // Tor exit node
    if (params.geo.isTor) score += 40;

    if (params.userId) {
      // New country login
      const isNewCountry = await this.isNewCountry(params.userId, params.geo.countryCode);
      if (isNewCountry) score += 25;

      // Rapid multi-IP switching
      const rapidSwitch = await this.detectRapidIpSwitch(params.userId, params.ipAddress);
      if (rapidSwitch) score += 20;
    }

    return Math.min(score, 100);
  }

  flagSuspiciousActivity(attempt: LoginAttempt): void {
    this.logger.warn(
      `Suspicious login: userId=${attempt.userId ?? 'anon'} ip=${attempt.ipAddress} ` +
        `score=${attempt.riskScore} action=${attempt.action}`,
    );
  }

  async getLoginHistory(
    userId: string,
    limit = 50,
  ): Promise<LoginAttempt[]> {
    return this.loginRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  // ─── IP block management ──────────────────────────────────────────────────

  async blockIP(ip: string): Promise<void> {
    await this.redis.sadd(BLOCKED_IP_KEY, ip);
    this.logger.warn(`IP blocked: ${ip}`);
  }

  async unblockIP(ip: string): Promise<void> {
    await this.redis.srem(BLOCKED_IP_KEY, ip);
    this.logger.log(`IP unblocked: ${ip}`);
  }

  async getBlockedIPs(): Promise<string[]> {
    return this.redis.smembers(BLOCKED_IP_KEY);
  }

  async isBlocked(ip: string): Promise<boolean> {
    return (await this.redis.sismember(BLOCKED_IP_KEY, ip)) === 1;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async isNewCountry(userId: string, countryCode: string | null): Promise<boolean> {
    if (!countryCode) return false;
    const previous = await this.loginRepo
      .createQueryBuilder('a')
      .select('DISTINCT a."countryCode"', 'countryCode')
      .where('a."userId" = :userId', { userId })
      .andWhere('a."countryCode" IS NOT NULL')
      .andWhere('a.action != :blocked', { blocked: LoginAction.BLOCKED })
      .getRawMany<{ countryCode: string }>();

    const known = new Set(previous.map((r) => r.countryCode));
    return !known.has(countryCode);
  }

  private async detectRapidIpSwitch(userId: string, currentIp: string): Promise<boolean> {
    const since = new Date(Date.now() - RAPID_IP_WINDOW_SECONDS * 1000);
    const recent = await this.loginRepo.find({
      where: { userId, createdAt: MoreThan(since) },
      select: ['ipAddress'],
    });
    const distinctIps = new Set(recent.map((r) => r.ipAddress));
    distinctIps.add(currentIp);
    return distinctIps.size >= RAPID_IP_THRESHOLD;
  }

  private async saveAttempt(data: Omit<LoginAttempt, 'id' | 'createdAt'>): Promise<LoginAttempt> {
    const attempt = this.loginRepo.create(data);
    return this.loginRepo.save(attempt);
  }
}
