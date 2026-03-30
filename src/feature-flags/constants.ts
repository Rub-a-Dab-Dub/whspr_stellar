export const FEATURE_FLAGS_CACHE_TTL_SECONDS = 30;
export const FEATURE_FLAGS_CACHE_KEY = 'feature-flags:all';
export const FEATURE_FLAG_EVALUATION_CACHE_PREFIX = 'feature-flags:evaluation';
export const FEATURE_FLAG_CHANGED_EVENT = 'feature-flags.changed';

export const featureFlagEvaluationCacheKey = (
  key: string,
  userId?: string | null,
  tier?: string | null,
): string =>
  `${FEATURE_FLAG_EVALUATION_CACHE_PREFIX}:${key}:${userId ?? 'anonymous'}:${tier ?? 'none'}`;
