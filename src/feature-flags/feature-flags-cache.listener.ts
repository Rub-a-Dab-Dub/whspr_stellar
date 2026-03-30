import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { FEATURE_FLAG_EVALUATION_CACHE_PREFIX, FEATURE_FLAGS_CACHE_KEY } from './constants';
import { FeatureFlagChangedPayload, FeatureFlagsEvents } from './feature-flags.events';

@Injectable()
export class FeatureFlagsCacheListener implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly cache: CacheService,
    private readonly events: FeatureFlagsEvents,
  ) {}

  private readonly onChangedHandler = async ({ key }: FeatureFlagChangedPayload): Promise<void> => {
    await this.cache.invalidateMany([FEATURE_FLAGS_CACHE_KEY]);
    await this.cache.invalidatePattern(`${FEATURE_FLAG_EVALUATION_CACHE_PREFIX}:${key}:*`);
  };

  onModuleInit(): void {
    this.events.onChanged(this.onChangedHandler);
  }

  onModuleDestroy(): void {
    this.events.offChanged(this.onChangedHandler);
  }
}
