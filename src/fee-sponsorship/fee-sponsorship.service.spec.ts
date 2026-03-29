import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { SystemSetting } from '../admin/entities/system-setting.entity';
import { Referral } from '../referrals/entities/referral.entity';
import { User, UserTier } from '../users/entities/user.entity';
import { FeeSponsorship } from './entities/fee-sponsorship.entity';
import { SponsorshipQuota } from './entities/sponsorship-quota.entity';
import { FeeSponsorshipService } from './fee-sponsorship.service';
import { StellarFeeBumpService } from './stellar-fee-bump.service';

describe('FeeSponsorshipService', () => {
  let service: FeeSponsorshipService;
  let sponsorships: any;
  let quotas: any;
  let users: any;
  let referrals: any;
  let settings: any;
  let dataSource: { transaction: jest.Mock; createQueryBuilder?: jest.Mock };
  let stellarFeeBump: { buildFeeBumpEnvelopeXdr: jest.Mock; isSponsorConfigured: jest.Mock };

  const userId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  const silverUser = (): User =>
    Object.assign(new User(), {
      id: userId,
      tier: UserTier.SILVER,
      createdAt: new Date(Date.now() - 90 * 86_400_000),
    });

  beforeEach(async () => {
    sponsorships = {
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      create: jest.fn((x) => Object.assign(new FeeSponsorship(), x)),
      save: jest.fn(async (x) => x),
    };
    quotas = {
      findOne: jest.fn(),
      create: jest.fn((x) => Object.assign(new SponsorshipQuota(), x)),
      save: jest.fn(async (x) => x),
    };
    users = { findOne: jest.fn() };
    referrals = { findOne: jest.fn() };
    settings = { findOne: jest.fn(), create: jest.fn((x) => x), save: jest.fn(async (x) => x) };

    dataSource = {
      transaction: jest.fn(async (fn: any) => {
        const manager = {
          getRepository: (entity: unknown) => {
            if (entity === SponsorshipQuota) {
              return {
                findOne: quotas.findOne,
                create: quotas.create,
                save: quotas.save,
              };
            }
            if (entity === FeeSponsorship) {
              return {
                create: sponsorships.create,
                save: sponsorships.save,
              };
            }
            if (entity === User) {
              return { findOne: users.findOne };
            }
            return {};
          },
        };
        return fn(manager);
      }),
    };

    stellarFeeBump = {
      buildFeeBumpEnvelopeXdr: jest.fn(),
      isSponsorConfigured: jest.fn().mockReturnValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeeSponsorshipService,
        { provide: getRepositoryToken(FeeSponsorship), useValue: sponsorships },
        { provide: getRepositoryToken(SponsorshipQuota), useValue: quotas },
        { provide: getRepositoryToken(User), useValue: users },
        { provide: getRepositoryToken(Referral), useValue: referrals },
        { provide: getRepositoryToken(SystemSetting), useValue: settings },
        { provide: DataSource, useValue: dataSource },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((_k: string, d?: string) => d ?? '') },
        },
        { provide: StellarFeeBumpService, useValue: stellarFeeBump },
      ],
    }).compile();

    service = module.get(FeeSponsorshipService);
  });

  it('currentPeriodUtc returns YYYY-MM', () => {
    const d = new Date(Date.UTC(2026, 2, 15));
    expect(service.currentPeriodUtc(d)).toBe('2026-03');
  });

  it('resetAtForPeriod returns first of next month UTC', () => {
    const r = service.resetAtForPeriod('2026-03');
    expect(r.toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });

  describe('checkEligibility', () => {
    it('rejects BLACK with zero quota', async () => {
      users.findOne.mockResolvedValue(
        Object.assign(new User(), {
          id: userId,
          tier: UserTier.BLACK,
          createdAt: new Date(),
        }),
      );
      settings.findOne.mockResolvedValue(null);
      const r = await service.checkEligibility(userId);
      expect(r.eligible).toBe(false);
      expect(r.reason).toBe('BLACK_TIER_SELF_PAY');
    });

    it('accepts SILVER', async () => {
      users.findOne.mockResolvedValue(silverUser());
      settings.findOne.mockResolvedValue(null);
      const r = await service.checkEligibility(userId);
      expect(r.eligible).toBe(true);
    });

    it('accepts old user with referral record', async () => {
      users.findOne.mockResolvedValue(
        Object.assign(new User(), {
          id: userId,
          tier: UserTier.GOLD,
          createdAt: new Date(Date.now() - 400 * 86_400_000),
        }),
      );
      referrals.findOne.mockResolvedValue({ id: 'r1' });
      settings.findOne.mockResolvedValue(null);
      const r = await service.checkEligibility(userId);
      expect(r.eligible).toBe(true);
    });

    it('accepts new user regardless of tier (non-Black)', async () => {
      users.findOne.mockResolvedValue(
        Object.assign(new User(), {
          id: userId,
          tier: UserTier.GOLD,
          createdAt: new Date(),
        }),
      );
      referrals.findOne.mockResolvedValue(null);
      settings.findOne.mockResolvedValue(null);
      const r = await service.checkEligibility(userId);
      expect(r.eligible).toBe(true);
    });

    it('rejects unknown user', async () => {
      users.findOne.mockResolvedValue(null);
      const r = await service.checkEligibility('00000000-0000-0000-0000-000000000099');
      expect(r.eligible).toBe(false);
      expect(r.reason).toBe('USER_NOT_FOUND');
    });
  });

  describe('sponsorTransaction', () => {
    it('increments quota and saves sponsorship', async () => {
      users.findOne.mockResolvedValue(silverUser());
      const q = Object.assign(new SponsorshipQuota(), {
        userId,
        period: service.currentPeriodUtc(),
        quotaUsed: 0,
        quotaLimit: 50,
        resetAt: service.resetAtForPeriod(service.currentPeriodUtc()),
      });
      quotas.findOne.mockResolvedValue(q);

      const rec = await service.sponsorTransaction({
        userId,
        txHash: 'abc123',
        feeAmountXlm: '0.00001',
        tokenId: 'XLM',
      });

      expect(rec.txHash).toBe('abc123');
      expect(q.quotaUsed).toBe(1);
    });

    it('throws when quota exhausted', async () => {
      users.findOne.mockResolvedValue(silverUser());
      dataSource.transaction.mockImplementation(async (fn: any) => {
        const exhausted = Object.assign(new SponsorshipQuota(), {
          userId,
          period: service.currentPeriodUtc(),
          quotaUsed: 50,
          quotaLimit: 50,
          resetAt: new Date(),
        });
        const manager = {
          getRepository: (entity: unknown) => {
            if (entity === SponsorshipQuota) {
              return {
                findOne: jest.fn().mockResolvedValue(exhausted),
                create: quotas.create,
                save: quotas.save,
              };
            }
            if (entity === User) {
              return { findOne: users.findOne };
            }
            return {};
          },
        };
        return fn(manager);
      });

      await expect(
        service.sponsorTransaction({
          userId,
          txHash: 'x',
          feeAmountXlm: '0.0001',
        }),
      ).rejects.toThrow(/exhausted/);
    });
  });

  describe('getSponsorshipHistory', () => {
    it('maps rows to DTOs', async () => {
      const row = Object.assign(new FeeSponsorship(), {
        id: 's1',
        txHash: 'tx',
        feeAmount: '0.0001',
        sponsoredBy: 'PLATFORM',
        tokenId: 'XLM',
        createdAt: new Date(),
      });
      sponsorships.findAndCount.mockResolvedValue([[row], 1]);
      const r = await service.getSponsorshipHistory(userId, 1, 10);
      expect(r.items).toHaveLength(1);
      expect(r.items[0].feeAmount).toBe('0.0001');
    });
  });

  describe('configureQuota', () => {
    it('persists settings', async () => {
      settings.findOne.mockResolvedValue(null);
      await service.configureQuota({ silverQuota: 55, goldQuota: 25 });
      expect(settings.save).toHaveBeenCalled();
    });

    it('updates existing setting row', async () => {
      settings.findOne.mockResolvedValue({
        key: 'sponsorship_silver_quota',
        value: '50',
      } as SystemSetting);
      await service.configureQuota({ silverQuota: 60 });
      expect(settings.save).toHaveBeenCalled();
    });
  });

  describe('buildFeeBumpEnvelope', () => {
    it('delegates to stellar service', () => {
      stellarFeeBump.buildFeeBumpEnvelopeXdr.mockReturnValue('feebump_xdr');
      expect(service.buildFeeBumpEnvelope('inner', '200')).toBe('feebump_xdr');
    });
  });

  describe('getRemainingQuota', () => {
    it('returns QUOTA_EXHAUSTED when used >= limit', async () => {
      users.findOne.mockResolvedValue(silverUser());
      settings.findOne.mockResolvedValue(null);
      const period = service.currentPeriodUtc();
      const q = Object.assign(new SponsorshipQuota(), {
        userId,
        period,
        quotaUsed: 50,
        quotaLimit: 50,
        resetAt: service.resetAtForPeriod(period),
      });
      quotas.findOne.mockResolvedValue(q);
      const r = await service.getRemainingQuota(userId);
      expect(r.remaining).toBe(0);
      expect(r.eligible).toBe(false);
      expect(r.ineligibleReason).toBe('QUOTA_EXHAUSTED');
    });

    it('creates quota row when missing', async () => {
      users.findOne.mockResolvedValue(silverUser());
      settings.findOne.mockResolvedValue(null);
      quotas.findOne.mockResolvedValue(null);
      quotas.save.mockImplementation(async (x: SponsorshipQuota) => x);
      const r = await service.getRemainingQuota(userId);
      expect(quotas.create).toHaveBeenCalled();
      expect(r.quotaLimit).toBe(50);
    });
  });

  describe('tryConsumeSponsorshipSlot', () => {
    it('returns false when ineligible', async () => {
      users.findOne.mockResolvedValue(
        Object.assign(new User(), {
          id: userId,
          tier: UserTier.BLACK,
          createdAt: new Date(),
        }),
      );
      settings.findOne.mockResolvedValue(null);
      const ok = await service.tryConsumeSponsorshipSlot({
        userId,
        txHash: 'h1',
        feeAmountXlm: '0.0001',
      });
      expect(ok).toBe(false);
    });

    it('returns true when eligible and quota available', async () => {
      users.findOne.mockResolvedValue(silverUser());
      referrals.findOne.mockResolvedValue(null);
      settings.findOne.mockResolvedValue(null);
      const period = service.currentPeriodUtc();
      const q = Object.assign(new SponsorshipQuota(), {
        userId,
        period,
        quotaUsed: 0,
        quotaLimit: 50,
        resetAt: service.resetAtForPeriod(period),
      });
      quotas.findOne.mockResolvedValue(q);
      dataSource.transaction.mockImplementation(async (fn: any) => {
        const manager = {
          getRepository: (entity: unknown) => {
            if (entity === SponsorshipQuota) {
              return {
                findOne: jest.fn().mockResolvedValue({ ...q, quotaUsed: 0 }),
                create: quotas.create,
                save: jest.fn(async (row: SponsorshipQuota) => row),
              };
            }
            if (entity === FeeSponsorship) {
              return {
                create: sponsorships.create,
                save: sponsorships.save,
              };
            }
            if (entity === User) {
              return { findOne: users.findOne };
            }
            return {};
          },
        };
        return fn(manager);
      });

      const ok = await service.tryConsumeSponsorshipSlot({
        userId,
        txHash: 'txok',
        feeAmountXlm: '0.0001',
      });
      expect(ok).toBe(true);
    });
  });

  describe('getConfiguredQuotas', () => {
    it('returns defaults when settings missing', async () => {
      settings.findOne.mockResolvedValue(null);
      const c = await service.getConfiguredQuotas();
      expect(c.silverQuota).toBe(50);
      expect(c.goldQuota).toBe(20);
      expect(c.blackQuota).toBe(0);
      expect(c.newUserDays).toBe(30);
    });

    it('uses stored silver quota from settings', async () => {
      settings.findOne.mockImplementation(async (opts: any) => {
        const k = opts?.where?.key as string;
        if (k === 'sponsorship_silver_quota') {
          return { key: k, value: '77' } as SystemSetting;
        }
        return null;
      });
      const c = await service.getConfiguredQuotas();
      expect(c.silverQuota).toBe(77);
    });
  });

  describe('monitorPlatformFeeAccountBalance', () => {
    it('no-op when public key not configured', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          FeeSponsorshipService,
          { provide: getRepositoryToken(FeeSponsorship), useValue: sponsorships },
          { provide: getRepositoryToken(SponsorshipQuota), useValue: quotas },
          { provide: getRepositoryToken(User), useValue: users },
          { provide: getRepositoryToken(Referral), useValue: referrals },
          { provide: getRepositoryToken(SystemSetting), useValue: settings },
          { provide: DataSource, useValue: dataSource },
          { provide: ConfigService, useValue: { get: jest.fn(() => '') } },
          { provide: StellarFeeBumpService, useValue: stellarFeeBump },
        ],
      }).compile();
      const svc = module.get(FeeSponsorshipService);
      await expect(svc.monitorPlatformFeeAccountBalance()).resolves.toBeUndefined();
    });
  });

  describe('resetQuotas', () => {
    it('runs delete for stale periods', async () => {
      const execute = jest.fn().mockResolvedValue({ affected: 2 });
      const qb = {
        delete: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute,
      };
      (dataSource as any).createQueryBuilder = jest.fn(() => qb);

      await service.resetQuotas();

      expect(execute).toHaveBeenCalled();
    });
  });

  describe('isFeeBumpAvailable', () => {
    it('delegates to stellar service', () => {
      stellarFeeBump.isSponsorConfigured.mockReturnValue(true);
      expect(service.isFeeBumpAvailable()).toBe(true);
    });
  });
});
