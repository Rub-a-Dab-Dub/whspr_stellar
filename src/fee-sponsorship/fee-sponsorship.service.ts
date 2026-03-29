import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, Repository } from 'typeorm';
import * as StellarSdk from '@stellar/stellar-sdk';
import { SystemSetting } from '../admin/entities/system-setting.entity';
import { Referral } from '../referrals/entities/referral.entity';
import { User, UserTier } from '../users/entities/user.entity';
import {
  DEFAULT_BLACK_QUOTA,
  DEFAULT_GOLD_QUOTA,
  DEFAULT_LOW_BALANCE_XLM,
  DEFAULT_NEW_USER_DAYS,
  DEFAULT_SILVER_QUOTA,
  SPONSORSHIP_SETTING_BLACK,
  SPONSORSHIP_SETTING_GOLD,
  SPONSORSHIP_SETTING_NEW_USER_DAYS,
  SPONSORSHIP_SETTING_SILVER,
} from './fee-sponsorship.constants';
import {
  AdminSponsorshipConfigDto,
  AdminSponsorshipConfigResponseDto,
  SponsorshipHistoryItemDto,
  SponsorshipQuotaResponseDto,
} from './dto/fee-sponsorship.dto';
import { FeeSponsorship, SponsorshipSource } from './entities/fee-sponsorship.entity';
import { SponsorshipQuota } from './entities/sponsorship-quota.entity';
import { StellarFeeBumpService } from './stellar-fee-bump.service';

export interface SponsorshipEligibility {
  eligible: boolean;
  reason?: string;
}

export interface SponsorTransactionInput {
  userId: string;
  txHash: string;
  feeAmountXlm: string;
  tokenId?: string | null;
  sponsoredBy?: SponsorshipSource;
}

@Injectable()
export class FeeSponsorshipService {
  private readonly logger = new Logger(FeeSponsorshipService.name);

  constructor(
    @InjectRepository(FeeSponsorship)
    private readonly sponsorships: Repository<FeeSponsorship>,
    @InjectRepository(SponsorshipQuota)
    private readonly quotas: Repository<SponsorshipQuota>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Referral)
    private readonly referrals: Repository<Referral>,
    @InjectRepository(SystemSetting)
    private readonly settings: Repository<SystemSetting>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly stellarFeeBump: StellarFeeBumpService,
  ) {}

  currentPeriodUtc(date = new Date()): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  /** First instant of the month after `period` (UTC). period format YYYY-MM with month 01-12. */
  resetAtForPeriod(period: string): Date {
    const [ys, ms] = period.split('-');
    const y = parseInt(ys, 10);
    const monthHuman = parseInt(ms, 10);
    return new Date(Date.UTC(y, monthHuman, 1));
  }

  private async getIntSetting(key: string, fallback: number): Promise<number> {
    const row = await this.settings.findOne({ where: { key } });
    if (!row?.value) {
      return fallback;
    }
    const n = parseInt(row.value, 10);
    return Number.isFinite(n) ? n : fallback;
  }

  private async tierQuotaLimit(tier: UserTier): Promise<number> {
    switch (tier) {
      case UserTier.SILVER:
        return this.getIntSetting(SPONSORSHIP_SETTING_SILVER, DEFAULT_SILVER_QUOTA);
      case UserTier.GOLD:
        return this.getIntSetting(SPONSORSHIP_SETTING_GOLD, DEFAULT_GOLD_QUOTA);
      case UserTier.BLACK:
        return this.getIntSetting(SPONSORSHIP_SETTING_BLACK, DEFAULT_BLACK_QUOTA);
      default:
        return DEFAULT_SILVER_QUOTA;
    }
  }

  private async newUserDays(): Promise<number> {
    return this.getIntSetting(SPONSORSHIP_SETTING_NEW_USER_DAYS, DEFAULT_NEW_USER_DAYS);
  }

  async getConfiguredQuotas(): Promise<AdminSponsorshipConfigResponseDto> {
    const [silverQuota, goldQuota, blackQuota, newUserDays] = await Promise.all([
      this.getIntSetting(SPONSORSHIP_SETTING_SILVER, DEFAULT_SILVER_QUOTA),
      this.getIntSetting(SPONSORSHIP_SETTING_GOLD, DEFAULT_GOLD_QUOTA),
      this.getIntSetting(SPONSORSHIP_SETTING_BLACK, DEFAULT_BLACK_QUOTA),
      this.getIntSetting(SPONSORSHIP_SETTING_NEW_USER_DAYS, DEFAULT_NEW_USER_DAYS),
    ]);
    return { silverQuota, goldQuota, blackQuota, newUserDays };
  }

  async configureQuota(dto: AdminSponsorshipConfigDto): Promise<AdminSponsorshipConfigResponseDto> {
    const upsert = async (key: string, value: number, description: string) => {
      let row = await this.settings.findOne({ where: { key } });
      if (!row) {
        row = this.settings.create({ key, value: String(value), description });
      } else {
        row.value = String(value);
      }
      await this.settings.save(row);
    };

    if (dto.silverQuota !== undefined) {
      await upsert(SPONSORSHIP_SETTING_SILVER, dto.silverQuota, 'Monthly sponsored tx quota for Silver tier');
    }
    if (dto.goldQuota !== undefined) {
      await upsert(SPONSORSHIP_SETTING_GOLD, dto.goldQuota, 'Monthly sponsored tx quota for Gold tier');
    }
    if (dto.blackQuota !== undefined) {
      await upsert(SPONSORSHIP_SETTING_BLACK, dto.blackQuota, 'Monthly sponsored tx quota for Black tier (0 = self-pay)');
    }
    if (dto.newUserDays !== undefined) {
      await upsert(
        SPONSORSHIP_SETTING_NEW_USER_DAYS,
        dto.newUserDays,
        'Account age in days treated as "new user" for sponsorship eligibility',
      );
    }

    return this.getConfiguredQuotas();
  }

  private accountAgeDays(user: User): number {
    const created = user.createdAt instanceof Date ? user.createdAt : new Date(user.createdAt);
    return (Date.now() - created.getTime()) / (86_400_000);
  }

  private async userHasReferralAsReferee(userId: string): Promise<boolean> {
    const row = await this.referrals.findOne({ where: { refereeId: userId } });
    return Boolean(row);
  }

  async checkEligibility(userId: string): Promise<SponsorshipEligibility> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      return { eligible: false, reason: 'USER_NOT_FOUND' };
    }

    if (user.tier === UserTier.BLACK) {
      const limit = await this.tierQuotaLimit(UserTier.BLACK);
      if (limit <= 0) {
        return { eligible: false, reason: 'BLACK_TIER_SELF_PAY' };
      }
    }

    const limit = await this.tierQuotaLimit(user.tier);
    if (limit <= 0) {
      return { eligible: false, reason: 'ZERO_QUOTA_LIMIT' };
    }

    const days = await this.newUserDays();
    const isNewUser = this.accountAgeDays(user) < days;
    const referred = await this.userHasReferralAsReferee(userId);
    const tierOk = user.tier === UserTier.SILVER || user.tier === UserTier.GOLD;

    if (tierOk || isNewUser || referred) {
      return { eligible: true };
    }

    return { eligible: false, reason: 'NOT_ELIGIBLE_TIER_OR_REFERRAL_OR_NEW' };
  }

  async getOrCreateQuotaRow(userId: string, period: string): Promise<SponsorshipQuota> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }
    const limit = await this.tierQuotaLimit(user.tier);
    let row = await this.quotas.findOne({ where: { userId, period } });
    if (!row) {
      row = this.quotas.create({
        userId,
        period,
        quotaUsed: 0,
        quotaLimit: limit,
        resetAt: this.resetAtForPeriod(period),
      });
      await this.quotas.save(row);
    } else if (row.quotaLimit !== limit) {
      row.quotaLimit = limit;
      row.resetAt = this.resetAtForPeriod(period);
      await this.quotas.save(row);
    }
    return row;
  }

  async getRemainingQuota(userId: string): Promise<SponsorshipQuotaResponseDto> {
    const period = this.currentPeriodUtc();
    const eligibility = await this.checkEligibility(userId);
    const row = await this.getOrCreateQuotaRow(userId, period);
    const remaining = Math.max(0, row.quotaLimit - row.quotaUsed);

    const eligible = eligibility.eligible && remaining > 0;
    let ineligibleReason: string | null = null;
    if (!eligibility.eligible) {
      ineligibleReason = eligibility.reason ?? 'INELIGIBLE';
    } else if (remaining <= 0) {
      ineligibleReason = 'QUOTA_EXHAUSTED';
    }

    return {
      period: row.period,
      quotaUsed: row.quotaUsed,
      quotaLimit: row.quotaLimit,
      remaining,
      resetAt: row.resetAt.toISOString(),
      eligible,
      ineligibleReason,
    };
  }

  /**
   * Records sponsorship and consumes one monthly quota slot (transactional).
   * Call after a sponsored tx is submitted (or simulated for stub flows).
   */
  async sponsorTransaction(input: SponsorTransactionInput): Promise<FeeSponsorship> {
    const period = this.currentPeriodUtc();
    return this.dataSource.transaction(async (manager) => {
      const quotaRepo = manager.getRepository(SponsorshipQuota);
      const sponsorshipRepo = manager.getRepository(FeeSponsorship);
      const userRepo = manager.getRepository(User);

      let row = await quotaRepo.findOne({
        where: { userId: input.userId, period },
        lock: { mode: 'pessimistic_write' },
      });

      if (!row) {
        const user = await userRepo.findOne({ where: { id: input.userId } });
        if (!user) {
          throw new Error('User not found');
        }
        const limit = await this.tierQuotaLimit(user.tier);
        row = quotaRepo.create({
          userId: input.userId,
          period,
          quotaUsed: 0,
          quotaLimit: limit,
          resetAt: this.resetAtForPeriod(period),
        });
        await quotaRepo.save(row);
      }

      if (!row || row.quotaUsed >= row.quotaLimit) {
        throw new Error('Sponsorship quota exhausted');
      }

      row.quotaUsed += 1;
      await quotaRepo.save(row);

      const rec = sponsorshipRepo.create({
        userId: input.userId,
        txHash: input.txHash,
        feeAmount: input.feeAmountXlm,
        sponsoredBy: input.sponsoredBy ?? SponsorshipSource.PLATFORM,
        tokenId: input.tokenId ?? null,
      });
      return sponsorshipRepo.save(rec);
    });
  }

  /**
   * If the user is eligible and has quota, records sponsorship and returns true.
   * Otherwise returns false without throwing.
   */
  async tryConsumeSponsorshipSlot(input: SponsorTransactionInput): Promise<boolean> {
    const eligibility = await this.checkEligibility(input.userId);
    if (!eligibility.eligible) {
      return false;
    }
    const period = this.currentPeriodUtc();
    await this.getOrCreateQuotaRow(input.userId, period);
    const remaining = await this.getRemainingQuota(input.userId);
    if (!remaining.eligible || remaining.remaining <= 0) {
      return false;
    }
    try {
      await this.sponsorTransaction(input);
      return true;
    } catch (e) {
      this.logger.warn(`Sponsorship consume failed: ${e instanceof Error ? e.message : e}`);
      return false;
    }
  }

  async getSponsorshipHistory(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ items: SponsorshipHistoryItemDto[]; total: number; page: number; limit: number }> {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;

    const [rows, total] = await this.sponsorships.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });

    const items: SponsorshipHistoryItemDto[] = rows.map((r) => ({
      id: r.id,
      txHash: r.txHash,
      feeAmount: r.feeAmount,
      sponsoredBy: r.sponsoredBy,
      tokenId: r.tokenId,
      createdAt: r.createdAt.toISOString(),
    }));

    return { items, total, page: Math.max(page, 1), limit: take };
  }

  /**
   * Monthly cron: prune very old quota rows and log period roll.
   * Quotas are keyed by calendar month; no in-place reset required.
   */
  @Cron('0 0 1 * *')
  async resetQuotas(): Promise<void> {
    this.logger.log(
      `Sponsorship monthly cron: new calendar period ${this.currentPeriodUtc()} (quotas are lazy per user/period)`,
    );
    const cutoff = new Date();
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 2);
    const oldPeriod = `${cutoff.getUTCFullYear()}-${String(cutoff.getUTCMonth() + 1).padStart(2, '0')}`;
    const result = await this.dataSource
      .createQueryBuilder()
      .delete()
      .from(SponsorshipQuota)
      .where('period < :oldPeriod', { oldPeriod })
      .execute();
    if (result.affected && result.affected > 0) {
      this.logger.log(`Removed ${result.affected} stale sponsorship_quota rows before ${oldPeriod}`);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async monitorPlatformFeeAccountBalance(): Promise<void> {
    const publicKey = this.configService.get<string>('SPONSORSHIP_PLATFORM_ACCOUNT_PUBLIC_KEY', '')?.trim();
    if (!publicKey) {
      return;
    }

    const threshold = parseFloat(
      this.configService.get<string>('SPONSORSHIP_LOW_BALANCE_XLM_THRESHOLD', String(DEFAULT_LOW_BALANCE_XLM)),
    );
    const useTestnet = this.configService.get<string>('SPONSORSHIP_BALANCE_NETWORK', 'testnet') === 'testnet';
    const horizonUrl = useTestnet
      ? this.configService.get<string>('STELLAR_HORIZON_TESTNET_URL', 'https://horizon-testnet.stellar.org')
      : this.configService.get<string>('STELLAR_HORIZON_MAINNET_URL', 'https://horizon.stellar.org');

    try {
      const server = new StellarSdk.Horizon.Server(horizonUrl);
      const account = await server.loadAccount(publicKey);
      const native = account.balances.find((b) => b.asset_type === 'native');
      const balance = native ? parseFloat((native as StellarSdk.Horizon.HorizonApi.BalanceLineNative).balance) : 0;
      if (balance < threshold) {
        this.logger.warn(
          `ADMIN_ALERT_SPONSORSHIP_LOW_BALANCE: platform account ${publicKey} has ${balance} XLM (threshold ${threshold} XLM, network=${useTestnet ? 'testnet' : 'mainnet'}) — top up required`,
        );
      }
    } catch (e) {
      this.logger.warn(
        `Sponsorship balance check failed for ${publicKey}: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  /**
   * Wraps a user-signed inner envelope in a fee-bump envelope (platform pays fees).
   */
  buildFeeBumpEnvelope(innerEnvelopeXdr: string, maxFeeStroops: string): string {
    return this.stellarFeeBump.buildFeeBumpEnvelopeXdr(innerEnvelopeXdr, maxFeeStroops);
  }

  isFeeBumpAvailable(): boolean {
    return this.stellarFeeBump.isSponsorConfigured();
  }
}
