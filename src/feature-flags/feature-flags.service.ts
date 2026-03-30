import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { UserTier } from '../users/entities/user.entity';
import {
  FEATURE_FLAGS_CACHE_KEY,
  FEATURE_FLAGS_CACHE_TTL_SECONDS,
  featureFlagEvaluationCacheKey,
} from './constants';
import { MyFeatureFlagResponseDto } from './dto/feature-flag-response.dto';
import { PatchFeatureFlagDto } from './dto/patch-feature-flag.dto';
import { FeatureFlag } from './entities/feature-flag.entity';
import { FeatureFlagsEvents } from './feature-flags.events';
import { FeatureFlagsRepository } from './feature-flags.repository';

@Injectable()
export class FeatureFlagsService {
  constructor(
    private readonly repository: FeatureFlagsRepository,
    private readonly cache: CacheService,
    private readonly events: FeatureFlagsEvents,
  ) {}

  async isEnabled(key: string): Promise<boolean> {
    const flag = await this.getFlag(key);
    return !!flag?.isEnabled;
  }

  async isEnabledForUser(key: string, userId: string, tier?: string | null): Promise<boolean> {
    return this.cache.getOrSet(
      featureFlagEvaluationCacheKey(key, userId, tier),
      FEATURE_FLAGS_CACHE_TTL_SECONDS,
      async () => {
        const flag = await this.getFlag(key);
        return this.evaluateFlag(flag, userId, tier);
      },
    );
  }

  async setFlag(key: string, patch: PatchFeatureFlagDto): Promise<FeatureFlag> {
    const existing = await this.repository.findByKey(key);
    const next = this.repository.create({
      key,
      isEnabled: patch.isEnabled ?? existing?.isEnabled ?? false,
      rolloutPercentage: patch.rolloutPercentage ?? existing?.rolloutPercentage ?? 0,
      allowedUserIds: [...new Set(patch.allowedUserIds ?? existing?.allowedUserIds ?? [])],
      allowedTiers: [...new Set(patch.allowedTiers ?? existing?.allowedTiers ?? [])],
      description: patch.description ?? existing?.description ?? null,
    });

    const saved = await this.repository.save(next);
    this.events.emitChanged({ key });
    return saved;
  }

  async getFlags(): Promise<FeatureFlag[]> {
    return this.cache.getOrSet(FEATURE_FLAGS_CACHE_KEY, FEATURE_FLAGS_CACHE_TTL_SECONDS, () =>
      this.repository.findAll(),
    );
  }

  async enableForTier(key: string, tier: UserTier): Promise<FeatureFlag> {
    const existing = await this.getFlag(key);
    const allowedTiers = new Set(existing?.allowedTiers ?? []);
    allowedTiers.add(tier);

    return this.setFlag(key, {
      isEnabled: true,
      allowedTiers: [...allowedTiers],
      rolloutPercentage: existing?.rolloutPercentage,
      allowedUserIds: existing?.allowedUserIds,
      description: existing?.description,
    });
  }

  async enableForUser(key: string, userId: string): Promise<FeatureFlag> {
    const existing = await this.getFlag(key);
    const allowedUserIds = new Set(existing?.allowedUserIds ?? []);
    allowedUserIds.add(userId);

    return this.setFlag(key, {
      isEnabled: true,
      allowedUserIds: [...allowedUserIds],
      allowedTiers: existing?.allowedTiers,
      rolloutPercentage: existing?.rolloutPercentage,
      description: existing?.description,
    });
  }

  async getFlagsForUser(userId: string, tier?: string | null): Promise<MyFeatureFlagResponseDto[]> {
    const flags = await this.getFlags();
    const results = await Promise.all(
      flags.map(async (flag) => ({
        key: flag.key,
        enabled: await this.isEnabledForUser(flag.key, userId, tier),
        rolloutPercentage: flag.rolloutPercentage,
        description: flag.description,
      })),
    );

    return results;
  }

  private async getFlag(key: string): Promise<FeatureFlag | null> {
    const flags = await this.getFlags();
    return flags.find((flag) => flag.key === key) ?? null;
  }

  private evaluateFlag(flag: FeatureFlag | null, userId: string, tier?: string | null): boolean {
    if (!flag?.isEnabled) {
      return false;
    }

    if (flag.allowedUserIds.includes(userId)) {
      return true;
    }

    if (tier && flag.allowedTiers.includes(tier as UserTier)) {
      return true;
    }

    if (flag.rolloutPercentage >= 100) {
      return true;
    }

    if (flag.rolloutPercentage <= 0) {
      return false;
    }

    const bucket = this.computeDeterministicRolloutBucket(flag.key, userId);
    return bucket < flag.rolloutPercentage;
  }

  private computeDeterministicRolloutBucket(key: string, userId: string): number {
    const digest = createHash('sha256').update(`${key}:${userId}`).digest('hex');
    return parseInt(digest.slice(0, 8), 16) % 100;
  }
}
