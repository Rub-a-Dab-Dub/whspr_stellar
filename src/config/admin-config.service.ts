import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminConfigService {
  constructor(private readonly configService: ConfigService) {}

  get jwtSecret(): string {
    const v = this.configService.get<string>('ADMIN_JWT_SECRET');
    if (!v) throw new Error('ADMIN_JWT_SECRET is required');
    return v;
  }

  get jwtExpiresIn(): string {
    return this.configService.get<string>('ADMIN_JWT_EXPIRES_IN') ?? '2h';
  }

  get jwtRefreshExpiresIn(): string {
    return this.configService.get<string>('ADMIN_JWT_REFRESH_EXPIRES_IN') ?? '7d';
  }

  get maxLoginAttempts(): number {
    return this.configService.get<number>('ADMIN_MAX_LOGIN_ATTEMPTS') ?? 5;
  }

  get lockoutDurationMs(): number {
    return this.configService.get<number>('ADMIN_LOCKOUT_DURATION_MS') ?? 1800000;
  }

  get rateLimitPerMinute(): number {
    return this.configService.get<number>('ADMIN_RATE_LIMIT_PER_MINUTE') ?? 60;
  }

  get largeTransactionThreshold(): number {
    return this.configService.get<number>('ADMIN_LARGE_TRANSACTION_THRESHOLD') ?? 10000;
  }

  // ─── SLA thresholds (hours) ──────────────────────────────────────────────

  get slaUrgentHours(): number {
    return Number(this.configService.get('SLA_URGENT_HOURS') ?? 2);
  }

  get slaHighHours(): number {
    return Number(this.configService.get('SLA_HIGH_HOURS') ?? 8);
  }

  get slaMediumHours(): number {
    return Number(this.configService.get('SLA_MEDIUM_HOURS') ?? 24);
  }

  get slaLowHours(): number {
    return Number(this.configService.get('SLA_LOW_HOURS') ?? 72);
  }
}
