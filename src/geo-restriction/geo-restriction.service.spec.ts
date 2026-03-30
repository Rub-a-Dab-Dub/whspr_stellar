import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GeoRestrictionService, OFAC_SANCTIONED_COUNTRIES } from './geo-restriction.service';
import { GeoRestriction, RestrictionType } from './entities/geo-restriction.entity';
import { UserGeoRecord } from './entities/user-geo-record.entity';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRestriction(overrides: Partial<GeoRestriction> = {}): GeoRestriction {
  return {
    id: 'uuid-1',
    countryCode: 'XX',
    restrictionType: RestrictionType.FULL_BLOCK,
    affectedFeatures: [],
    reason: 'test',
    isActive: true,
    createdAt: new Date(),
    ...overrides,
  } as GeoRestriction;
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRestrictionRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
};

const mockGeoRecordRepo = {
  create: jest.fn(),
  save: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string, def?: any) => {
    if (key === 'GEO_STRICT_VPN') return false;
    return def;
  }),
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('GeoRestrictionService', () => {
  let service: GeoRestrictionService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeoRestrictionService,
        { provide: getRepositoryToken(GeoRestriction), useValue: mockRestrictionRepo },
        { provide: getRepositoryToken(UserGeoRecord), useValue: mockGeoRecordRepo },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get(GeoRestrictionService);
  });

  // ── checkRestrictions ──────────────────────────────────────────────────────

  describe('checkRestrictions', () => {
    it('returns OFAC virtual FULL_BLOCK for sanctioned country without DB call', async () => {
      const [sanctioned] = [...OFAC_SANCTIONED_COUNTRIES];
      const result = await service.checkRestrictions(sanctioned);
      expect(result).toHaveLength(1);
      expect(result[0].restrictionType).toBe(RestrictionType.FULL_BLOCK);
      expect(mockRestrictionRepo.find).not.toHaveBeenCalled();
    });

    it('queries DB for non-sanctioned country', async () => {
      mockRestrictionRepo.find.mockResolvedValue([]);
      await service.checkRestrictions('DE');
      expect(mockRestrictionRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { countryCode: 'DE', isActive: true } }),
      );
    });

    it('is case-insensitive for country code', async () => {
      mockRestrictionRepo.find.mockResolvedValue([]);
      const result = await service.checkRestrictions('de');
      expect(result).toHaveLength(0);
    });
  });

  // ── getRestrictionsForCountry ──────────────────────────────────────────────

  describe('getRestrictionsForCountry', () => {
    it('returns DB rules', async () => {
      const rule = makeRestriction({ countryCode: 'NG', restrictionType: RestrictionType.KYC_REQUIRED });
      mockRestrictionRepo.find.mockResolvedValue([rule]);
      const result = await service.getRestrictionsForCountry('NG');
      expect(result).toEqual([rule]);
    });

    it('caches results and avoids second DB call', async () => {
      mockRestrictionRepo.find.mockResolvedValue([]);
      await service.getRestrictionsForCountry('FR');
      await service.getRestrictionsForCountry('FR');
      expect(mockRestrictionRepo.find).toHaveBeenCalledTimes(1);
    });
  });

  // ── applyRestriction ───────────────────────────────────────────────────────

  describe('applyRestriction', () => {
    it('throws ForbiddenException for OFAC country', async () => {
      const [sanctioned] = [...OFAC_SANCTIONED_COUNTRIES];
      await expect(service.applyRestriction(sanctioned)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for FULL_BLOCK from DB', async () => {
      mockRestrictionRepo.find.mockResolvedValue([
        makeRestriction({ countryCode: 'XX', restrictionType: RestrictionType.FULL_BLOCK }),
      ]);
      await expect(service.applyRestriction('XX')).rejects.toThrow(ForbiddenException);
    });

    it('returns allowed=false for feature-level restriction', async () => {
      mockRestrictionRepo.find.mockResolvedValue([
        makeRestriction({
          countryCode: 'AU',
          restrictionType: RestrictionType.FEATURE_LIMIT,
          affectedFeatures: ['payments'],
        }),
      ]);
      const result = await service.applyRestriction('AU', 'payments');
      expect(result.allowed).toBe(false);
      expect(result.restrictionType).toBe(RestrictionType.FEATURE_LIMIT);
    });

    it('returns allowed=true when feature is not in restriction list', async () => {
      mockRestrictionRepo.find.mockResolvedValue([
        makeRestriction({
          countryCode: 'AU',
          restrictionType: RestrictionType.FEATURE_LIMIT,
          affectedFeatures: ['payments'],
        }),
      ]);
      const result = await service.applyRestriction('AU', 'messaging');
      expect(result.allowed).toBe(true);
    });

    it('returns allowed=true with KYC_REQUIRED type when only KYC restriction', async () => {
      mockRestrictionRepo.find.mockResolvedValue([
        makeRestriction({ countryCode: 'IN', restrictionType: RestrictionType.KYC_REQUIRED }),
      ]);
      const result = await service.applyRestriction('IN');
      expect(result.allowed).toBe(true);
      expect(result.restrictionType).toBe(RestrictionType.KYC_REQUIRED);
    });

    it('throws ForbiddenException for VPN in strict mode', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'GEO_STRICT_VPN') return true;
      });
      mockRestrictionRepo.find.mockResolvedValue([]);
      await expect(service.applyRestriction('GB', undefined, true)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows VPN in non-strict mode', async () => {
      mockRestrictionRepo.find.mockResolvedValue([]);
      const result = await service.applyRestriction('GB', undefined, true);
      expect(result.allowed).toBe(true);
    });
  });

  // ── getBlockedCountries ────────────────────────────────────────────────────

  describe('getBlockedCountries', () => {
    it('returns all active restrictions', async () => {
      const rules = [makeRestriction(), makeRestriction({ id: 'uuid-2' })];
      mockRestrictionRepo.find.mockResolvedValue(rules);
      expect(await service.getBlockedCountries()).toHaveLength(2);
    });
  });

  // ── addRestriction ─────────────────────────────────────────────────────────

  describe('addRestriction', () => {
    it('saves and returns restriction, invalidates cache', async () => {
      const restriction = makeRestriction({ countryCode: 'ZZ' });
      mockRestrictionRepo.create.mockReturnValue(restriction);
      mockRestrictionRepo.save.mockResolvedValue(restriction);

      const result = await service.addRestriction({
        countryCode: 'ZZ',
        restrictionType: RestrictionType.FULL_BLOCK,
      });

      expect(result).toBe(restriction);
      expect(mockRestrictionRepo.save).toHaveBeenCalled();
    });

    it('upcases countryCode', async () => {
      const restriction = makeRestriction({ countryCode: 'ZZ' });
      mockRestrictionRepo.create.mockReturnValue(restriction);
      mockRestrictionRepo.save.mockResolvedValue(restriction);

      await service.addRestriction({ countryCode: 'zz', restrictionType: RestrictionType.FULL_BLOCK });
      expect(mockRestrictionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ countryCode: 'ZZ' }),
      );
    });
  });

  // ── removeRestriction ──────────────────────────────────────────────────────

  describe('removeRestriction', () => {
    it('deactivates an existing restriction', async () => {
      mockRestrictionRepo.findOne.mockResolvedValue(makeRestriction({ id: 'uuid-1' }));
      mockRestrictionRepo.update.mockResolvedValue(undefined);

      await service.removeRestriction('uuid-1');

      expect(mockRestrictionRepo.update).toHaveBeenCalledWith('uuid-1', { isActive: false });
    });

    it('throws NotFoundException for unknown id', async () => {
      mockRestrictionRepo.findOne.mockResolvedValue(null);
      await expect(service.removeRestriction('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── logGeoRecord ───────────────────────────────────────────────────────────

  describe('logGeoRecord', () => {
    it('creates and saves a geo record', async () => {
      const record = { id: 'r1', userId: 'u1', detectedCountry: 'GB', ipAddress: '1.2.3.4', isVPN: false, detectedAt: new Date() };
      mockGeoRecordRepo.create.mockReturnValue(record);
      mockGeoRecordRepo.save.mockResolvedValue(record);

      const result = await service.logGeoRecord('u1', '1.2.3.4', 'gb');
      expect(result).toBe(record);
      expect(mockGeoRecordRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ detectedCountry: 'GB' }),
      );
    });
  });

  // ── getMyRestrictions ──────────────────────────────────────────────────────

  describe('getMyRestrictions', () => {
    it('returns isFullyBlocked=true for OFAC country', async () => {
      const [sanctioned] = [...OFAC_SANCTIONED_COUNTRIES];
      const result = await service.getMyRestrictions(sanctioned, false);
      expect(result.isFullyBlocked).toBe(true);
    });

    it('returns feature list for FEATURE_LIMIT country', async () => {
      mockRestrictionRepo.find.mockResolvedValue([
        makeRestriction({
          countryCode: 'CN',
          restrictionType: RestrictionType.FEATURE_LIMIT,
          affectedFeatures: ['nfts', 'staking'],
        }),
      ]);
      const result = await service.getMyRestrictions('CN', false);
      expect(result.blockedFeatures).toEqual(['nfts', 'staking']);
      expect(result.isFullyBlocked).toBe(false);
    });

    it('returns requiresKyc=true for KYC_REQUIRED country', async () => {
      mockRestrictionRepo.find.mockResolvedValue([
        makeRestriction({ countryCode: 'TR', restrictionType: RestrictionType.KYC_REQUIRED }),
      ]);
      const result = await service.getMyRestrictions('TR', false);
      expect(result.requiresKyc).toBe(true);
    });

    it('includes isVPN flag in response', async () => {
      mockRestrictionRepo.find.mockResolvedValue([]);
      const result = await service.getMyRestrictions('GB', true);
      expect(result.isVPN).toBe(true);
    });
  });

  // ── OFAC list ──────────────────────────────────────────────────────────────

  describe('OFAC_SANCTIONED_COUNTRIES', () => {
    it('contains the expected sanctioned country codes', () => {
      expect(OFAC_SANCTIONED_COUNTRIES.has('IR')).toBe(true);
      expect(OFAC_SANCTIONED_COUNTRIES.has('KP')).toBe(true);
      expect(OFAC_SANCTIONED_COUNTRIES.has('SY')).toBe(true);
      expect(OFAC_SANCTIONED_COUNTRIES.has('CU')).toBe(true);
      expect(OFAC_SANCTIONED_COUNTRIES.has('US')).toBe(false);
      expect(OFAC_SANCTIONED_COUNTRIES.has('GB')).toBe(false);
    });
  });
});
