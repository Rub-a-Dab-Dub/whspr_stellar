import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { GeoRestriction, RestrictionType } from './entities/geo-restriction.entity';
import { UserGeoRecord } from './entities/user-geo-record.entity';
import {
  ApplyRestrictionResultDto,
  CreateGeoRestrictionDto,
  GeoRestrictionResponseDto,
  MyRestrictionsResponseDto,
} from './dto/geo-restriction.dto';

/**
 * OFAC-sanctioned countries per the SDN list.
 * Source: https://home.treasury.gov/policy-issues/financial-sanctions/sanctions-list-service
 */
export const OFAC_SANCTIONED_COUNTRIES = new Set([
  'CU', // Cuba
  'IR', // Iran
  'KP', // North Korea
  'SY', // Syria
  'RU', // Russia (sectoral)
  'BY', // Belarus
  'MM', // Myanmar
  'VE', // Venezuela (sectoral)
  'SD', // Sudan
  'ZW', // Zimbabwe
  'CD', // DRC
  'LY', // Libya
  'SO', // Somalia
  'YE', // Yemen
  'AF', // Afghanistan
]);

const CACHE_TTL_SECONDS = 5 * 60; // 5 minutes

@Injectable()
export class GeoRestrictionService {
  private readonly logger = new Logger(GeoRestrictionService.name);

  /**
   * In-memory cache of restriction rules (keyed by country code).
   * Invalidated on writes; refreshed lazily with a TTL.
   */
  private cache = new Map<string, { rules: GeoRestriction[]; expiresAt: number }>();

  constructor(
    @InjectRepository(GeoRestriction)
    private readonly restrictionRepo: Repository<GeoRestriction>,
    @InjectRepository(UserGeoRecord)
    private readonly geoRecordRepo: Repository<UserGeoRecord>,
    private readonly configService: ConfigService,
  ) {}

  // ── Public: check & apply ──────────────────────────────────────────────────

  /**
   * Check all active restrictions for a given country code.
   * OFAC countries are blocked regardless of DB entries.
   */
  async checkRestrictions(countryCode: string): Promise<GeoRestriction[]> {
    const upper = countryCode.toUpperCase();

    // OFAC is always enforced — synthesise a virtual FULL_BLOCK entry.
    if (OFAC_SANCTIONED_COUNTRIES.has(upper)) {
      return [this.buildOfacEntry(upper)];
    }

    return this.getRestrictionsForCountry(upper);
  }

  /**
   * Load active DB restrictions for a country (with 5-min cache).
   */
  async getRestrictionsForCountry(countryCode: string): Promise<GeoRestriction[]> {
    const upper = countryCode.toUpperCase();
    const cached = this.cache.get(upper);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.rules;
    }

    const rules = await this.restrictionRepo.find({
      where: { countryCode: upper, isActive: true },
    });

    this.cache.set(upper, { rules, expiresAt: Date.now() + CACHE_TTL_SECONDS * 1_000 });
    return rules;
  }

  /**
   * Evaluate whether a request from `countryCode` should be allowed.
   * Throws ForbiddenException for FULL_BLOCK; returns result dto otherwise.
   *
   * @param feature  Optional feature slug to check FEATURE_LIMIT rules.
   * @param isVPN    Whether the requesting IP is a known VPN.
   */
  async applyRestriction(
    countryCode: string,
    feature?: string,
    isVPN = false,
  ): Promise<ApplyRestrictionResultDto> {
    const upper = countryCode.toUpperCase();
    const strictVpn = this.configService.get<boolean>('GEO_STRICT_VPN', false);

    const restrictions = await this.checkRestrictions(upper);
    const fullBlock = restrictions.find((r) => r.restrictionType === RestrictionType.FULL_BLOCK);

    if (fullBlock) {
      throw new ForbiddenException(
        fullBlock.reason ?? `Access from ${upper} is not permitted.`,
      );
    }

    // VPN: if strict mode is on, treat VPN like an unknown country.
    if (isVPN && strictVpn) {
      throw new ForbiddenException('VPN usage is not permitted in strict compliance mode.');
    }

    if (feature) {
      const featureBlock = restrictions.find(
        (r) =>
          r.restrictionType === RestrictionType.FEATURE_LIMIT &&
          r.affectedFeatures?.includes(feature),
      );

      if (featureBlock) {
        return {
          allowed: false,
          reason: featureBlock.reason ?? `Feature "${feature}" is not available in ${upper}.`,
          restrictionType: RestrictionType.FEATURE_LIMIT,
        };
      }
    }

    const kycRequired = restrictions.some(
      (r) => r.restrictionType === RestrictionType.KYC_REQUIRED,
    );

    return {
      allowed: true,
      restrictionType: kycRequired ? RestrictionType.KYC_REQUIRED : undefined,
    };
  }

  // ── Admin: CRUD ────────────────────────────────────────────────────────────

  async getBlockedCountries(): Promise<GeoRestriction[]> {
    return this.restrictionRepo.find({ where: { isActive: true } });
  }

  async addRestriction(dto: CreateGeoRestrictionDto): Promise<GeoRestriction> {
    const restriction = this.restrictionRepo.create({
      ...dto,
      countryCode: dto.countryCode.toUpperCase(),
      isActive: true,
    });
    const saved = await this.restrictionRepo.save(restriction);
    this.invalidateCache(saved.countryCode);
    this.logger.log(`Added ${saved.restrictionType} restriction for ${saved.countryCode}`);
    return saved;
  }

  async removeRestriction(id: string): Promise<void> {
    const restriction = await this.restrictionRepo.findOne({ where: { id } });
    if (!restriction) throw new NotFoundException(`Restriction ${id} not found`);

    await this.restrictionRepo.update(id, { isActive: false });
    this.invalidateCache(restriction.countryCode);
    this.logger.log(`Removed restriction ${id} for ${restriction.countryCode}`);
  }

  // ── Geo record logging ─────────────────────────────────────────────────────

  async logGeoRecord(
    userId: string,
    ipAddress: string,
    detectedCountry: string,
    isVPN = false,
  ): Promise<UserGeoRecord> {
    const record = this.geoRecordRepo.create({
      userId,
      ipAddress,
      detectedCountry: detectedCountry.toUpperCase(),
      isVPN,
    });
    return this.geoRecordRepo.save(record);
  }

  /**
   * Build a user-facing restrictions summary for the given country.
   */
  async getMyRestrictions(
    countryCode: string,
    isVPN: boolean,
  ): Promise<MyRestrictionsResponseDto> {
    const upper = countryCode.toUpperCase();
    const isOfac = OFAC_SANCTIONED_COUNTRIES.has(upper);

    const restrictions = isOfac
      ? [this.buildOfacEntry(upper)]
      : await this.getRestrictionsForCountry(upper);

    const isFullyBlocked =
      isOfac || restrictions.some((r) => r.restrictionType === RestrictionType.FULL_BLOCK);

    const blockedFeatures = restrictions
      .filter((r) => r.restrictionType === RestrictionType.FEATURE_LIMIT)
      .flatMap((r) => r.affectedFeatures ?? []);

    const requiresKyc = restrictions.some(
      (r) => r.restrictionType === RestrictionType.KYC_REQUIRED,
    );

    return {
      countryCode: upper,
      isVPN,
      restrictions: restrictions.map(this.toResponseDto),
      blockedFeatures: [...new Set(blockedFeatures)],
      requiresKyc,
      isFullyBlocked,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private invalidateCache(countryCode: string): void {
    this.cache.delete(countryCode.toUpperCase());
  }

  private buildOfacEntry(countryCode: string): GeoRestriction {
    const entry = new GeoRestriction();
    entry.id = 'ofac';
    entry.countryCode = countryCode;
    entry.restrictionType = RestrictionType.FULL_BLOCK;
    entry.reason = `${countryCode} is subject to OFAC sanctions. Access is not permitted.`;
    entry.isActive = true;
    entry.createdAt = new Date(0);
    return entry;
  }

  private toResponseDto(r: GeoRestriction): GeoRestrictionResponseDto {
    return {
      id: r.id,
      countryCode: r.countryCode,
      restrictionType: r.restrictionType,
      affectedFeatures: r.affectedFeatures,
      reason: r.reason,
      isActive: r.isActive,
      createdAt: r.createdAt,
    };
  }
}
